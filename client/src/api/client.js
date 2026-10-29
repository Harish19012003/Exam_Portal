import axios from 'axios';

// The base URL should come from Vite env variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7002/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Automatically sends and receives HTTP-only server cookies
});

// Request interceptor: attach bearer token if present in localStorage as a backup
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const clearSession = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('sessionActive');
  localStorage.removeItem('accessCache');
};

// Single-flight refresh: concurrent callers share one in-flight request.
let refreshPromise = null;

/**
 * Exchanges the refresh token (HTTP-only cookie, localStorage as fallback)
 * for a new access/refresh pair. Resolves with the new access token.
 * Only an explicit 401/403 from the server ends the session; network errors
 * and 5xx leave it intact.
 */
export const refreshSession = () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios
    .post(
      `${API_URL}/auth/refresh`,
      { refreshToken: localStorage.getItem('refreshToken') },
      { withCredentials: true }
    )
    .then((response) => {
      const data = response.data?.data || {};
      if (data.accessToken) localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('sessionActive', 'true');
      return data.accessToken;
    })
    .catch((refreshError) => {
      const status = refreshError.response?.status;
      if ((status === 401 || status === 403) && navigator.onLine) {
        clearSession();
        window.location.href = '/login';
      }
      throw refreshError;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

const getTokenExpiryMs = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

const REFRESH_MARGIN_MS = 60 * 1000;
let keeperTimer = null;

const scheduleRefresh = () => {
  clearTimeout(keeperTimer);
  const token = localStorage.getItem('accessToken');
  const exp = token ? getTokenExpiryMs(token) : null;
  // Re-check in a minute if there's nothing to schedule yet (e.g. before login).
  const delay = exp ? Math.max(exp - Date.now() - REFRESH_MARGIN_MS, 5000) : 60 * 1000;
  keeperTimer = setTimeout(async () => {
    if (localStorage.getItem('sessionActive') === 'true') {
      try {
        await refreshSession();
      } catch {
        // transient failure: the next 401 or timer tick retries
      }
    }
    scheduleRefresh();
  }, delay);
};

/**
 * Keeps a logged-in user signed in for the refresh token's lifetime:
 * refreshes on app start if the access token is expired/near expiry,
 * shortly before it expires, and when the tab becomes visible again.
 */
export const startSessionKeeper = () => {
  const refreshIfNeeded = async () => {
    if (localStorage.getItem('sessionActive') !== 'true') return;
    const exp = getTokenExpiryMs(localStorage.getItem('accessToken') || '');
    if (!exp || exp - Date.now() < REFRESH_MARGIN_MS) {
      try {
        await refreshSession();
      } catch {
        // offline or server restarting: keep the session, retry later
      }
    }
    scheduleRefresh();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshIfNeeded();
  });
  window.addEventListener('online', refreshIfNeeded);
  refreshIfNeeded();
};

// Response interceptor: on 401, refresh once and replay the request
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // No response (server restarting / offline): keep the session intact.
    if (!error.response) {
      return Promise.reject(error);
    }

    // Don't try to refresh for auth endpoints (login, refresh, logout, otp)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');
    if (error.response.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const newAccessToken = await refreshSession();
      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
