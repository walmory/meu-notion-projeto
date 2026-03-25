import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://apinotion.andrekehrer.com';
const AUTH_TOKEN_KEY = 'notion_token';
// Aumentando Max-Age do cookie de sessão para 30 dias para evitar deslogar no Electron
const AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

const readCookie = (key: string) => {
  if (typeof document === 'undefined') {
    return null;
  }
  const parts = document.cookie.split(';').map((part) => part.trim());
  const entry = parts.find((part) => part.startsWith(`${key}=`));
  if (!entry) {
    return null;
  }
  return decodeURIComponent(entry.slice(key.length + 1));
};

const writeCookie = (key: string, value: string, maxAgeSeconds: number) => {
  if (typeof document === 'undefined') {
    return;
  }
  const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  // Max-Age e Expires garantem que o cookie não seja tratado como "session cookie"
  const expiresDate = new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();
  document.cookie = `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; Expires=${expiresDate}; SameSite=Lax${secureFlag}`;
};

export const getAuthToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const localToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (localToken) {
    return localToken;
  }
  const cookieToken = readCookie(AUTH_TOKEN_KEY);
  if (cookieToken) {
    localStorage.setItem(AUTH_TOKEN_KEY, cookieToken);
    return cookieToken;
  }
  return null;
};

export const setAuthToken = (token: string) => {
  if (typeof window === 'undefined' || !token) {
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  writeCookie(AUTH_TOKEN_KEY, token, AUTH_TOKEN_MAX_AGE_SECONDS);
};

export const clearAuthToken = () => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
  writeCookie(AUTH_TOKEN_KEY, '', 0);
};

export const setAuthSession = (token: string, workspaceId?: string | null) => {
  if (typeof window === 'undefined' || !token) {
    return;
  }
  setAuthToken(token);
  if (workspaceId) {
    localStorage.setItem('activeWorkspaceId', workspaceId);
  } else {
    localStorage.removeItem('activeWorkspaceId');
  }
  window.dispatchEvent(new Event('workspace-changed'));
  window.dispatchEvent(new Event('auth-changed'));
};

export const clearAuthSession = () => {
  if (typeof window === 'undefined') {
    return;
  }
  clearAuthToken();
  localStorage.removeItem('activeWorkspaceId');
  localStorage.removeItem('user_profile_cache');
  window.dispatchEvent(new Event('auth-changed'));
};

export const getAuthHeaders = () => {
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    const workspaceId = localStorage.getItem('activeWorkspaceId');
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (workspaceId) headers['x-workspace-id'] = workspaceId;
    return headers;
  }
  return {};
};

export const getUserFromToken = () => {
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
          id: payload.user_id,
          email: payload.email,
          name: payload.name || payload.email || 'User',
        };
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

api.interceptors.request.use((config) => {
  const headers = getAuthHeaders();
  if (headers.Authorization) {
    config.headers.Authorization = headers.Authorization;
  }
  if (headers['x-workspace-id']) {
    config.headers['x-workspace-id'] = headers['x-workspace-id'];
  }
  // Evitar cache agressivo do navegador em requisições GET que causam "ghosting"
  if (config.method?.toUpperCase() === 'GET') {
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const suppressGlobalErrorLog = Boolean((error.config as { suppressGlobalErrorLog?: boolean } | undefined)?.suppressGlobalErrorLog);
    const status = error.response?.status;
    const responseData = error.response?.data;
    const details = responseData?.details;
    const url = error.config?.url;
    if (!suppressGlobalErrorLog) {
      console.error('Axios Error:', {
        status,
        url,
        message: error.message,
        data: responseData,
        details
      });
    }
    
    // Auto-logout on 401 Unauthorized
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      clearAuthSession();
      window.location.href = '/login';
    }
    
    // Se for 403 (Forbidden), pode ser que o activeWorkspaceId esteja inválido
    if (error.response?.status === 403 && typeof window !== 'undefined') {
      console.warn('Acesso negado ao workspace atual. Limpando cache do workspace.');
      localStorage.removeItem('activeWorkspaceId');
      // Força um reload para o SWR e a UI buscarem um novo workspace válido
      window.location.href = '/';
    }
    
    return Promise.reject(error);
  }
);
