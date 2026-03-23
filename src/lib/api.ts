import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://meu-notion-projeto.onrender.com';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'skip-browser-warning': 'true',
    'ngrok-skip-browser-warning': 'true',
  },
});

export const getAuthHeaders = () => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('notion_token');
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
    const token = localStorage.getItem('notion_token');
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
      localStorage.removeItem('notion_token');
      localStorage.removeItem('activeWorkspaceId');
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
