import { createContext, useContext } from 'react';

export type UserRole = 'admin' | 'warehouse' | 'viewer';

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
};

const TOKEN_KEY = 'stockbase_auth_token';

function resolveAuthApi(): string {
  const env = import.meta.env.VITE_API_URL;
  if (env === undefined || env === null) return 'https://functions.poehali.dev/95288880-cdba-4f48-b5e8-7f16fb9d0e31';
  if (env === '' || env === '/') return '/api/auth';
  return `${env}/api/auth`;
}
const AUTH_API = resolveAuthApi();

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiLogin(username: string, password: string): Promise<{ token: string; user: AuthUser } | { error: string }> {
  try {
    const res = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username, password }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Ошибка входа' };
    return { token: json.token, user: json.user };
  } catch {
    return { error: 'Нет связи с сервером' };
  }
}

export async function apiMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${AUTH_API}?action=me`, {
      headers: { 'X-Auth-Token': token },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.user || null;
  } catch {
    return null;
  }
}

export async function apiLogout(): Promise<void> {
  const token = getToken();
  if (token) {
    fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(() => {});
  }
  clearToken();
}

export async function apiListUsers(): Promise<AuthUser[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${AUTH_API}?action=list_users`, {
      headers: { 'X-Auth-Token': token },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.users || [];
  } catch {
    return [];
  }
}

export async function apiRegister(data: { username: string; password: string; displayName: string; role: UserRole }): Promise<{ user?: AuthUser; error?: string }> {
  const token = getToken();
  try {
    const res = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' },
      body: JSON.stringify({ action: 'register', ...data }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Ошибка' };
    return { user: json.user };
  } catch {
    return { error: 'Нет связи с сервером' };
  }
}

export async function apiChangePassword(userId: string, newPassword: string): Promise<{ error?: string }> {
  const token = getToken();
  try {
    const res = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' },
      body: JSON.stringify({ action: 'change_password', userId, newPassword }),
    });
    if (!res.ok) { const json = await res.json(); return { error: json.error }; }
    return {};
  } catch {
    return { error: 'Нет связи' };
  }
}

export async function apiUpdateUser(userId: string, data: Partial<{ displayName: string; role: UserRole; isActive: boolean }>): Promise<{ error?: string }> {
  const token = getToken();
  try {
    const res = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' },
      body: JSON.stringify({ action: 'update_user', userId, ...data }),
    });
    if (!res.ok) { const json = await res.json(); return { error: json.error }; }
    return {};
  } catch {
    return { error: 'Нет связи' };
  }
}

export async function apiDeleteUser(userId: string): Promise<{ error?: string }> {
  const token = getToken();
  try {
    const res = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' },
      body: JSON.stringify({ action: 'delete_user', userId }),
    });
    if (!res.ok) { const json = await res.json(); return { error: json.error }; }
    return {};
  } catch {
    return { error: 'Нет связи' };
  }
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
  user: null,
  loading: true,
  login: async () => null,
  logout: async () => {},
  refresh: async () => {},
  canEdit: false,
  isAdmin: false,
});

export function useAuth() {
  return useContext(AuthContext);
}