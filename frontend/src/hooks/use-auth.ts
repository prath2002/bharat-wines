import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Role, User } from '@/types/auth';

/**
 * Decode the JWT payload to build the real user object.
 * Backend embeds { sub, business_id, role } in the access token.
 */
export function decodeUser(accessToken: string, email?: string): User {
  const payload = JSON.parse(
    atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
  );
  return {
    id: payload.sub,
    business_id: payload.business_id,
    role: (payload.role as Role) ?? Role.STAFF,
    email: email ?? '',
    name: email ? email.split('@')[0] : 'User',
  };
}

export interface LoginRequest {
  email: string;
  password?: string;
  [key: string]: any;
}

export interface RegisterRequest {
  email: string;
  password?: string;
  name?: string;
  business_name?: string;
  [key: string]: any;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user?: User;
}

export const useAuth = () => {
  const router = useRouter();
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      const response = await apiClient.post<TokenResponse>('/auth/login', data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      const user = decodeUser(data.access_token, variables.email);
      setAuth(user, data.access_token, data.refresh_token);
      router.push('/');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const response = await apiClient.post<TokenResponse>('/auth/register', data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      const user = decodeUser(data.access_token, variables.email);
      setAuth(user, data.access_token, data.refresh_token);
      router.push('/');
    },
  });

  const logout = async () => {
    try {
      const store = useAuthStore.getState();
      if (store.refreshToken) {
        await apiClient.post('/auth/logout', { refresh_token: store.refreshToken });
      }
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout,
  };
};
