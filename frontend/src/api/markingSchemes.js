import axiosInstance from './axiosInstance';

export const getMarkingSchemes = () =>
  axiosInstance.get('/api/marking-schemes/');

export const getMarkingSchemeById = (id) =>
  axiosInstance.get(`/api/marking-schemes/${id}/`);

export const getMarkingScheme = (subjectId) =>
  axiosInstance.get('/api/marking-schemes/', { params: { subject_id: subjectId } });


export const createMarkingScheme = (data) =>
  axiosInstance.post('/api/marking-schemes/', data);

export const updateMarkingScheme = (id, data) =>
  axiosInstance.put(`/api/marking-schemes/${id}/`, data);

export const getSubjects = (params = {}) =>
  axiosInstance.get('/api/subjects/', { params });

export const createSubject = (data) =>
  axiosInstance.post('/api/subjects/', data);

export const updateSubject = (id, data) =>
  axiosInstance.put(`/api/subjects/${id}/`, data);

export const deleteSubject = (id) =>
  axiosInstance.delete(`/api/subjects/${id}/`);
