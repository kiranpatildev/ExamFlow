import axiosInstance from './axiosInstance';

export const createBundle = (qrRawData) =>
  axiosInstance.post('/api/bundles/', { qr_raw_data: qrRawData });

export const getBundles = (params = {}) =>
  axiosInstance.get('/api/bundles/', { params });

export const getBundleById = (id) =>
  axiosInstance.get(`/api/bundles/${id}/`);

export const submitBundle = (id) =>
  axiosInstance.patch(`/api/bundles/${id}/submit/`);
