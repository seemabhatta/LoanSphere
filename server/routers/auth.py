from fastapi import APIRouter, Request, HTTPException, Depends, status
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from authlib.common.security import generate_token
import httpx
import os
from typing import Optional, Dict, Any
import json
from loguru import logger
from pydantic import BaseModel

# Debug: Print environment variables to see if they're loaded
logger.info(f"Google Client ID: {os.getenv('GOOGLE_CLIENT_ID', 'NOT SET')}")
logger.info(f"Google Client Secret: {'SET' if os.getenv('GOOGLE_CLIENT_SECRET') else 'NOT SET'}")

router = APIRouter()

# OAuth2 configuration
oauth = OAuth()

# OAuth provider configurations
OAUTH_PROVIDERS = {
    "google": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "server_metadata_url": "https://accounts.google.com/.well-known/openid-configuration",
        "client_kwargs": {
            "scope": "openid email profile"
        }
    },
    "github": {
        "client_id": os.getenv("GITHUB_CLIENT_ID"),
        "client_secret": os.getenv("GITHUB_CLIENT_SECRET"),
        "access_token_url": "https://github.com/login/oauth/access_token",
        "authorize_url": "https://github.com/login/oauth/authorize",
        "api_base_url": "https://api.github.com/",
        "client_kwargs": {
            "scope": "user:email"
        }
    },
    "facebook": {
        "client_id": os.getenv("FACEBOOK_APP_ID"),
        "client_secret": os.getenv("FACEBOOK_APP_SECRET"),
        "access_token_url": "https://graph.facebook.com/oauth/access_token",
        "authorize_url": "https://www.facebook.com/dialog/oauth",
        "api_base_url": "https://graph.facebook.com/",
        "client_kwargs": {
            "scope": "email"
        }
    }
}

# Register OAuth providers
for name, config in OAUTH_PROVIDERS.items():
    if config["client_id"] and config["client_secret"]:
        oauth.register(
            name,
            client_id=config["client_id"],
            client_secret=config["client_secret"],
            **{k: v for k, v in config.items() if k not in ["client_id", "client_secret"]}
        )
        logger.info(f"Registered OAuth provider: {name}")

class UserSession(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    profile_image_url: Optional[str] = None
    provider: str

# In-memory session store (use Redis or database in production)
sessions: Dict[str, UserSession] = {}

async def get_user_info(provider: str, token: dict) -> Dict[str, Any]:
    """Get user information from OAuth provider"""
    
    if provider == "google":
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {token['access_token']}"}
            )
            user_data = response.json()
            return {
                "id": f"google_{user_data['id']}",
                "email": user_data["email"],
                "first_name": user_data.get("given_name", ""),
                "last_name": user_data.get("family_name", ""),
                "profile_image_url": user_data.get("picture"),
                "provider": "google"
            }
    
    elif provider == "github":
        async with httpx.AsyncClient() as client:
            # Get user info
            response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"token {token['access_token']}"}
            )
            user_data = response.json()
            
            # Get user email
            email_response = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"token {token['access_token']}"}
            )
            emails = email_response.json()
            primary_email = next((email["email"] for email in emails if email["primary"]), None)
            
            name_parts = (user_data.get("name") or "").split(" ", 1)
            return {
                "id": f"github_{user_data['id']}",
                "email": primary_email or user_data.get("email", ""),
                "first_name": name_parts[0] if name_parts else user_data["login"],
                "last_name": name_parts[1] if len(name_parts) > 1 else "",
                "profile_image_url": user_data.get("avatar_url"),
                "provider": "github"
            }
    
    elif provider == "facebook":
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.facebook.com/me",
                params={
                    "fields": "id,email,first_name,last_name,picture.type(large)",
                    "access_token": token["access_token"]
                }
            )
            user_data = response.json()
            return {
                "id": f"facebook_{user_data['id']}",
                "email": user_data.get("email", ""),
                "first_name": user_data.get("first_name", ""),
                "last_name": user_data.get("last_name", ""),
                "profile_image_url": user_data.get("picture", {}).get("data", {}).get("url"),
                "provider": "facebook"
            }
    
    raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

@router.get("/providers")
async def get_providers():
    """Get list of available OAuth providers"""
    available_providers = []
    
    for name, config in OAUTH_PROVIDERS.items():
        if config["client_id"] and config["client_secret"]:
            available_providers.append({
                "name": name,
                "display_name": name.capitalize(),
                "login_url": f"/api/auth/{name}"
            })
    
    return {"providers": available_providers}

@router.get("/user")
async def get_current_user(request: Request):
    """Get current authenticated user"""
    session_token = request.cookies.get("session_token")
    
    logger.info(f"Auth check - cookies: {dict(request.cookies)}")
    logger.info(f"Auth check - session_token: {session_token}")
    logger.info(f"Auth check - available sessions: {len(sessions)}")
    
    if not session_token or session_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return sessions[session_token]

@router.post("/logout")
async def logout(request: Request):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    
    if session_token and session_token in sessions:
        del sessions[session_token]
    
    response = RedirectResponse(url="/login")
    response.delete_cookie("session_token")
    return response

@router.get("/{provider}")
async def oauth_login(provider: str, request: Request):
    """Initiate OAuth login with provider"""
    # Skip if this is not actually a provider route
    if provider in ["user", "providers", "logout"]:
        raise HTTPException(status_code=404, detail="Not found")
        
    if provider not in OAUTH_PROVIDERS:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=400, detail=f"Provider {provider} not configured")
    
    # Use hardcoded redirect URI to match Google OAuth settings
    if provider == "google":
        redirect_uri = "http://localhost:5000/api/auth/google/callback"
    else:
        redirect_uri = f"http://localhost:5000/api/auth/{provider}/callback"
    
    return await client.authorize_redirect(request, redirect_uri)

@router.get("/{provider}/callback")
async def oauth_callback(provider: str, request: Request):
    """Handle OAuth callback"""
    if provider not in OAUTH_PROVIDERS:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=400, detail=f"Provider {provider} not configured")
    
    try:
        token = await client.authorize_access_token(request)
        user_info = await get_user_info(provider, token)
        
        # Create session
        session_token = generate_token()
        sessions[session_token] = UserSession(**user_info)
        
        logger.info(f"Created session for user: {user_info['email']} with token: {session_token[:10]}...")
        logger.info(f"Total sessions: {len(sessions)}")
        
        # Redirect to frontend with session token
        response = RedirectResponse(url="/")
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=False,  # Set to False for localhost development
            samesite="lax",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        return response
        
    except Exception as e:
        logger.error(f"OAuth callback error for {provider}: {str(e)}")
        return RedirectResponse(url="/login?error=auth_failed")

# Dependency to get current user
async def get_current_user_dependency(request: Request) -> UserSession:
    """Dependency to get current authenticated user"""
    session_token = request.cookies.get("session_token")
    
    if not session_token or session_token not in sessions:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return sessions[session_token]

# Export the dependency for use in other routers
CurrentUser = Depends(get_current_user_dependency)