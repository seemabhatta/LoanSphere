import { useQuery } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string;
  provider: string;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
  };
}