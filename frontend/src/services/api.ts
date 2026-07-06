import axios from 'axios';
import type {
  Document,
  DocumentListResponse,
  QueryResponse,
  StatsResponse,
  HealthResponse,
  ObservabilityResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.detail || err.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export const documentsApi = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Document>('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },

  list: () => api.get<DocumentListResponse>('/documents'),
  get: (id: string) => api.get<Document>(`/documents/${id}`),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export const queryApi = {
  query: (question: string, top_k = 5, session_id?: string) =>
    api.post<QueryResponse>('/query', { question, top_k, session_id }),

  history: (limit = 20) =>
    api.get<{ queries: QueryResponse[]; total: number }>(`/queries?limit=${limit}`),
};

export const systemApi = {
  stats: () => api.get<StatsResponse>('/stats'),
  health: () => api.get<HealthResponse>('/health', { baseURL: '' }),
  observability: () => api.get<ObservabilityResponse>('/observability'),
};
