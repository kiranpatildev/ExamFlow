import axiosInstance from './axiosInstance';

export const submitEvaluation = (data) =>
  axiosInstance.post('/api/evaluations/', data);

export const getEvaluation = (answerSheetId) =>
  axiosInstance.get(`/api/evaluations/${answerSheetId}/`);
