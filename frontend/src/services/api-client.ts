import axios from 'axios';
import { useAuthStore } from './../store/auth-store';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  // Needed so the httpOnly refresh-token cookie is sent to /auth/refresh and
  // /auth/logout, and stored from /auth/login and /auth/register.
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Concurrent requests that 401 at the same time must share a single refresh
// call -- the backend rotates the refresh token on each use, so a second,
// independent refresh attempt would race against the first and fail because
// the token it holds was already revoked.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${apiClient.defaults.baseURL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        const { access_token } = res.data;
        const store = useAuthStore.getState();
        if (store.user) {
          store.setAuth(store.user, access_token);
        }
        return access_token as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true;
      try {
        const access_token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (err) {
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);
