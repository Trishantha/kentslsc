import axios from 'axios';

export const baseURL = '/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// These endpoints are allowed to return 401 for anonymous users on public pages.
// They should not trigger a forced redirect to the login page.
const optionalAuthEndpoints = ['/auth/me', '/auth/features'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const isOptionalAuth = optionalAuthEndpoints.some((url) =>
        originalRequest.url?.includes(url)
      );
      if (isOptionalAuth) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        return api(originalRequest);
      } catch {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);
