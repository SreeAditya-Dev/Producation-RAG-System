import axios from 'axios';
import type {
  Document,
  DocumentListResponse,
  QueryResponse,
  StatsResponse,
  HealthResponse,
  ObservabilityResponse,
  FeedbackAggregatesResponse,
  FeedbackReviewCandidatesResponse,
} from '../types';
import { getClientId } from './clientId';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 120000,
});

// /query is the one endpoint that can legitimately run for minutes: when CRAG
// grades the retrieved context incorrect/ambiguous it runs a second retrieval
// round plus a web-search fallback before generation even starts. Aborting here
// does not cancel the backend — the pipeline finishes and delivers the answer
// over the WebSocket — so a tight timeout produces a false error toast next to a
// correct on-screen answer rather than saving anyone any waiting.
const QUERY_TIMEOUT_MS = 300000;

api.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  config.headers['X-Client-Id'] = getClientId();
  return config;
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
    api.post<QueryResponse>('/query', { question, top_k, session_id }, { timeout: QUERY_TIMEOUT_MS }),

  history: (limit = 20) =>
    api.get<{ queries: QueryResponse[]; total: number }>(`/queries?limit=${limit}`),

  getValidationMetrics: (params: {
    page?: number;
    limit?: number;
    status?: string;
    crag_grade?: string;
    citation_valid?: boolean;
    feedback?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.crag_grade) searchParams.set('crag_grade', params.crag_grade);
    if (params.citation_valid !== undefined) searchParams.set('citation_valid', params.citation_valid.toString());
    if (params.feedback) searchParams.set('feedback', params.feedback);
    if (params.search) searchParams.set('search', params.search);
    return api.get<import('../types').ValidationMetricsResponse>(`/queries/validation-metrics?${searchParams.toString()}`);
  },

  feedback: (queryId: string, rating: 'up' | 'down', correction?: string, reason?: string) =>
    api.post(`/queries/${queryId}/feedback`, { rating, correction, reason }),
};

export const systemApi = {
  stats: () => api.get<StatsResponse>('/stats'),
  health: () => api.get<HealthResponse>('/health', { baseURL: API_BASE_URL }),
  observability: () => api.get<ObservabilityResponse>('/observability'),
};

export const feedbackApi = {
  aggregates: () => api.get<FeedbackAggregatesResponse>('/feedback/aggregates'),

  // Read-only export of down-rated / corrected queries. The backend has no write
  // path from here into fixtures or indexes — approved cases are committed by hand.
  reviewCandidates: (limit = 200) =>
    api.get<FeedbackReviewCandidatesResponse>(`/feedback/review-candidates?limit=${limit}`),
};
