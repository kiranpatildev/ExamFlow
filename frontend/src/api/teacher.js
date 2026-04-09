import axiosInstance from './axiosInstance';

export const getTeacherBundles = () =>
  axiosInstance.get('/api/teacher/bundles/');

export const getTeacherBundleSheets = (bundleId) =>
  axiosInstance.get(`/api/teacher/bundles/${bundleId}/sheets/`);

export const getAnswerSheetDetails = (sheetId) =>
  axiosInstance.get(`/api/answer-sheets/${sheetId}/`);

export const getAnswerSheetPdf = (sheetId) =>
  axiosInstance.get(`/api/answer-sheets/${sheetId}/pdf/`, { responseType: 'blob' });

export const getDraftEvaluation = (sheetId) =>
  axiosInstance.get(`/api/evaluations/draft/${sheetId}/`);

export const saveDraftEvaluation = (data) =>
  axiosInstance.post('/api/evaluations/draft/', data);

export const submitEvaluation = (data) =>
  axiosInstance.post('/api/evaluations/submit/', data);
