import axios from 'axios';
import { useAuth } from '../store/auth';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response && err.response.status === 401) {
      const { token, logout } = useAuth.getState();
      if (token) logout();
    }
    return Promise.reject(err);
  }
);

export function apiError(err, fallback = 'Terjadi kesalahan') {
  return err?.response?.data?.error || err?.message || fallback;
}
