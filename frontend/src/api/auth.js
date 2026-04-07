import axiosInstance from './axiosInstance';

export const login = (username, password) =>
  axiosInstance.post('/api/auth/login/', { username, password });

export const refreshToken = (refresh) =>
  axiosInstance.post('/api/auth/refresh/', { refresh });

export const getTeachers = () =>
  axiosInstance.get('/api/auth/teachers/');
