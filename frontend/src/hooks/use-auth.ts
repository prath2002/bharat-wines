import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { User } from '@/types/auth';

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
    onSuccess: (data) => {
      // In a real application, you would decode the JWT to get the user object.
      // For this implementation, we will mock the user object from the token response.
      // Normally: const user = jwtDecode(data.access_token);
      const userMock = {
        id: '1',
        business_id: '1',
        name: 'User',
        email: 'user@example.com',
        role: 'ADMIN' as any,
        is_active: true,
        created_at: new Date().toISOString()
      };
      setAuth(userMock, data.access_token, data.refresh_token);
      router.push('/');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const response = await apiClient.post<TokenResponse>('/auth/register', data);
      return response.data;
    },
    onSuccess: (data) => {
      const userMock = {
        id: '1',
        business_id: '1',
        name: 'Owner',
        email: 'owner@example.com',
        role: 'ADMIN' as any,
        is_active: true,
        created_at: new Date().toISOString()
      };
      setAuth(userMock, data.access_token, data.refresh_token);
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
