import axiosInstance from './axiosInstance';

export const login = (username, password) =>
  axiosInstance.post('/api/auth/login/', { username, password });

export const refreshToken = (refresh) =>
  axiosInstance.post('/api/auth/refresh/', { refresh });

export const getTeachers = () =>
  axiosInstance.get('/api/auth/teachers/');

// User Management (exam_dept only)
export const getUsers = (params = {}) =>
  axiosInstance.get('/api/auth/users/', { params });

export const createUser = (data) =>
  axiosInstance.post('/api/auth/users/', data);

export const updateUser = (id, data) =>
  axiosInstance.patch(`/api/auth/users/${id}/`, data);

export const deleteUser = (id) =>
  axiosInstance.delete(`/api/auth/users/${id}/`);
