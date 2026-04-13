import { createContext, useContext } from 'react';

export type UserRole = 'admin' | 'warehouse' | 'viewer';

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
};

const TOKEN_KEY = 'stockbase_auth_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const LOCAL_ADMIN: AuthUser = {
  id: 'local-admin',
  username: 'admin',
  displayName: 'Администратор',
  role: 'admin',
};

export async function apiLogin(_username: string, _password: string): Promise<{ token: string; user: AuthUser } | { error: string }> {
  setToken('local-token');
  return { token: 'local-token', user: LOCAL_ADMIN };
}

export async function apiMe(): Promise<AuthUser | null> {
  return LOCAL_ADMIN;
}

export async function apiLogout(): Promise<void> {
  clearToken();
}

export async function apiListUsers(): Promise<AuthUser[]> {
  return [LOCAL_ADMIN];
}

export async function apiRegister(_data: { username: string; password: string; displayName: string; role: UserRole }): Promise<{ user?: AuthUser; error?: string }> {
  return { error: 'Локальный режим — управление пользователями недоступно' };
}

export async function apiChangePassword(_userId: string, _newPassword: string): Promise<{ error?: string }> {
  return { error: 'Локальный режим — управление пользователями недоступно' };
}

export async function apiUpdateUser(_userId: string, _data: Partial<{ displayName: string; role: UserRole; isActive: boolean }>): Promise<{ error?: string }> {
  return { error: 'Локальный режим — управление пользователями недоступно' };
}

export async function apiDeleteUser(_userId: string): Promise<{ error?: string }> {
  return { error: 'Локальный режим — управление пользователями недоступно' };
}

export type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  canEdit: boolean;
  isAdmin: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  user: LOCAL_ADMIN,
  loading: false,
  login: async () => null,
  logout: async () => {},
  refresh: async () => {},
  canEdit: true,
  isAdmin: true,
});

export function useAuth() {
  return useContext(AuthContext);
}
