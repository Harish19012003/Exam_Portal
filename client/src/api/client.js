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

// Single flight refresh handling (queue multiple concurrent requests during refresh)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle 401 with resilient retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If there is no response (e.g. server is restarting or network is offline),
    // DO NOT force logout! Keep the user's session intact.
    if (!error.response) {
      return Promise.reject(error);
    }

    // Only handle 401 Unauthorized errors that haven't been retried yet
    // Do not attempt refresh on auth endpoints (login, refresh, logout, otp)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');
    if (error.response.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue the request until the single in-flight refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = localStorage.getItem('refreshToken');

        // Call refresh endpoint with server cookies enabled
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true }
        );

        const data = response.data?.data || {};
        const newAccessToken = data.accessToken;
        const newRefreshToken = data.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('accessToken', newAccessToken);
        }
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        processQueue(null, newAccessToken);

        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // CRITICAL: ONLY force logout if the server explicitly rejected the refresh token (401 or 403).
        // If the server is restarting (5xx, network error, timeout) or user is offline, DO NOT LOG OUT!
        const isDefinitiveAuthFailure =
          refreshError.response &&
          (refreshError.response.status === 401 || refreshError.response.status === 403);

        if (isDefinitiveAuthFailure && navigator.onLine) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          localStorage.removeItem('sessionActive');
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

