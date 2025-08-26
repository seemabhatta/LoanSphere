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

# OAuth provider configurations - Google only
OAUTH_PROVIDERS = {
    "google": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "server_metadata_url": "https://accounts.google.com/.well-known/openid-configuration",
        "client_kwargs": {
            "scope": "openid email profile"
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
    """Get user information from Google OAuth provider"""
    
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
    
    raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

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

@router.get("/logout")
@router.post("/logout") 
async def logout(request: Request):
    """Logout user - accepts both GET and POST"""
    session_token = request.cookies.get("session_token")
    
    if session_token and session_token in sessions:
        del sessions[session_token]
        logger.info(f"Logged out user with token: {session_token[:10]}...")
    
    response = RedirectResponse(url="/")
    response.delete_cookie("session_token")
    return response

@router.get("/google")
async def google_oauth_login(request: Request):
    """Initiate Google OAuth login"""
    client = oauth.create_client("google")
    if not client:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")
    
    redirect_uri = "http://localhost:5000/api/auth/google/callback"
    return await client.authorize_redirect(request, redirect_uri)

@router.get("/google/callback")
async def google_oauth_callback(request: Request):
    """Handle Google OAuth callback"""
    client = oauth.create_client("google")
    if not client:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")
    
    try:
        token = await client.authorize_access_token(request)
        user_info = await get_user_info("google", token)
        
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
        logger.error(f"Google OAuth callback error: {str(e)}")
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