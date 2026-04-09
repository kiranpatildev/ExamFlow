import axiosInstance from './axiosInstance';

export const uploadImage = (formData) =>
  axiosInstance.post('/api/answer-sheets/upload-image/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const deleteImage = (imageId) =>
  axiosInstance.delete(`/api/answer-sheets/upload-image/${imageId}/`);

export const finalizeSheet = (data) =>
  axiosInstance.post('/api/answer-sheets/finalize/', data);

export const getAnswerSheets = (params = {}) =>
  axiosInstance.get('/api/answer-sheets/', { params });

export const getAnswerSheetDetail = (sheetId) =>
  axiosInstance.get(`/api/answer-sheets/${sheetId}/`);


export const assignTeacher = (sheetId, teacherId) =>
  axiosInstance.patch(`/api/answer-sheets/${sheetId}/assign/`, { teacher_id: teacherId });

export const getAnswerSheetPdfUrl = (sheetId) =>
  `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/answer-sheets/${sheetId}/pdf/`;

