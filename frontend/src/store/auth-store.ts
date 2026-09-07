import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
}

// The refresh token lives only in an httpOnly cookie set by the backend --
// it is never readable by JS, so it has no place in this store.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) => {
        if (typeof window !== "undefined") {
            localStorage.setItem("token", accessToken);
        }
        set({ user, accessToken, isAuthenticated: true });
      },
      clearAuth: () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("token");
        }
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
