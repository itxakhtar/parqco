import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('parqco_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default api;
