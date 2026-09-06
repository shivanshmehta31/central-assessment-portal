import { api } from './api';
import { useAuthStore } from './auth-store';
import type { AuthUser, UserRole } from './types';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function login(identifier: string, password: string, expectedRole: UserRole) {
  const data = await api.post<LoginResponse>('/auth/login', { identifier, password, expectedRole });
  useAuthStore.getState().setSession(data.user, data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout() {
  const { refreshToken, clear } = useAuthStore.getState();
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch {
    // ignore network errors on logout
  }
  clear();
}

export function homeForRole(role: UserRole) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'FACULTY') return '/faculty/dashboard';
  return '/student/dashboard';
}
