export type DocumentStatus = 'processing' | 'ready' | 'error';
export type FileType = 'pdf' | 'txt' | 'docx' | 'md' | 'markdown';

export interface Document {
  id: string;
  original_name: string;
  file_type: FileType;
  status: DocumentStatus;
  chunk_count: number;
  file_size: number;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export interface SourceChunk {
  doc_id: string;
  original_name: string;
  chunk_index: number;
  text: string;
  score: number;
  file_type: string;
}

export interface QueryResponse {
  query_id: string;
  session_id?: string;
  question: string;
  answer: string;
  sources: SourceChunk[];
  processing_time: number;
  created_at: string;
  status?: 'success' | 'error';
  failure_stage?: string | null;
  // Only `/api/queries` populates these, and only with the calling client's own
  // rating — they let a reloaded session show which answers were already voted on.
  feedback_rating?: 'up' | 'down' | null;
  feedback_reason?: string | null;
}

export interface QueryHistoryItem extends QueryResponse {}

export interface StatsResponse {
  total_documents: number;
  total_chunks: number;
  total_queries: number;
  failed_queries: number;
  failed_ingestions: number;
  index_stats: {
    total_vector_count?: number;
    dimension?: number;
    index_fullness?: number;
    namespaces?: Record<string, number>;
  };
}

export interface HealthResponse {
  status: string;
  pinecone: string;
  nvidia: string;
  version: string;
}

// ── Observability ─────────────────────────────────────────────────────────────

export interface LatencyStats {
  avg_total_ms: number | null;
  p95_total_ms: number | null;
  avg_embed_ms: number | null;
  avg_retrieve_ms: number | null;
  avg_rerank_ms: number | null;
  avg_llm_ms: number | null;
}

export interface IngestionLatencyStats {
  avg_total_ms: number | null;
  avg_download_ms: number | null;
  avg_parse_ms: number | null;
  avg_chunk_ms: number | null;
  avg_embed_ms: number | null;
  avg_store_ms: number | null;
}

export interface TokenStats {
  avg_prompt_tokens: number | null;
  avg_completion_tokens: number | null;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  avg_embed_tokens: number | null;
  total_embed_tokens: number;
}

export interface RetrievalStats {
  avg_score_mean: number | null;
  avg_score_max: number | null;
  avg_rerank_top: number | null;
  avg_reranker_relevance_proxy: number | null;
  low_reranker_relevance_proxy_count: number;
}

export interface FailureStats {
  total_queries: number;
  failed_queries: number;
  query_failure_rate: number;
  total_ingestions: number;
  failed_ingestions: number;
  ingestion_failure_rate: number;
  by_stage: Record<string, number>;
  recent: Array<{
    type: 'query' | 'ingestion';
    id: string;
    question?: string;
    stage?: string;
    error_type?: string;
    at: string;
  }>;
}

export interface ObservabilityResponse {
  latency: LatencyStats;
  ingestion_latency: IngestionLatencyStats;
  tokens: TokenStats;
  retrieval: RetrievalStats;
  failures: FailureStats;
}

// ── Feedback ──────────────────────────────────────────────────────────────────

// A closed vocabulary, not free text: `/api/feedback/aggregates` groups by the
// raw `reason` column, so anything typed by hand would shard into one-off
// buckets and never form a signal.
export const FEEDBACK_REASONS = [
  { value: 'incorrect', label: 'Incorrect', hint: 'The answer states something false' },
  { value: 'incomplete', label: 'Incomplete', hint: 'Left out information that is in the documents' },
  { value: 'unsupported', label: 'Unsupported', hint: 'Not backed by the sources it cited' },
  { value: 'wrong_sources', label: 'Wrong sources', hint: 'Retrieval surfaced the wrong chunks' },
  { value: 'unclear', label: 'Unclear', hint: 'Hard to follow or badly structured' },
] as const;

export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]['value'];

export const FEEDBACK_REASON_LABELS: Record<string, string> = Object.fromEntries(
  FEEDBACK_REASONS.map((reason) => [reason.value, reason.label])
);

export interface FeedbackReviewCandidate {
  query_id: string;
  question: string;
  answer: string | null;
  rating: 'up' | 'down' | null;
  correction: string | null;
  reason: string | null;
}

export interface FeedbackReviewCandidatesResponse {
  requires_human_approval: boolean;
  candidates: FeedbackReviewCandidate[];
}

export interface FeedbackAggregatesResponse {
  feedback_count: number;
  positive_feedback_rate: number | null;
  negative_feedback_reasons: Record<string, number>;
  cache_types: Record<string, number>;
  retry_rate: number;
  citation_failures: number;
  prompt_token_percentiles: {
    p50: number | null;
    p95: number | null;
  };
}

export interface ValidationMetricItem {
  query_id: string;
  session_id?: string;
  question: string;
  answer: string | null;
  sources: SourceChunk[];
  created_at: string | null;
  status: string;
  failure_stage?: string | null;
  error_type?: string | null;
  processing_time: number;
  total_ms?: number | null;
  embed_ms?: number | null;
  retrieve_ms?: number | null;
  rerank_ms?: number | null;
  llm_ms?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  candidate_count?: number | null;
  returned_count?: number | null;
  retrieval_score_max?: number | null;
  retrieval_score_mean?: number | null;
  crag_grade?: string | null;
  crag_confidence?: number | null;
  crag_web_results_used?: number | null;
  citation_valid?: boolean | null;
  citation_cited_source_count?: number | null;
  citation_invalid_citations?: string | null;
  cache_type?: string | null;
  retry_attempt_count?: number;
  retry_reason?: string | null;
  feedback_rating?: 'up' | 'down' | null;
  feedback_reason?: string | null;
  feedback_correction?: string | null;
}

export interface ValidationMetricsResponse {
  summary: {
    total_queries: number;
    avg_total_ms: number;
    avg_retrieval_score: number;
    crag_grades: {
      correct: number;
      ambiguous: number;
      incorrect: number;
    };
    citation_valid_pct: number;
    positive_feedback: number;
    negative_feedback: number;
  };
  items: ValidationMetricItem[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}


// ── WebSocket event types ─────────────────────────────────────────────────────

export type WSEventType =
  | 'ingestion_started'
  | 'parsing_started'
  | 'parsing_completed'
  | 'chunking_started'
  | 'chunking_completed'
  | 'embedding_started'
  | 'chunk_embedded'
  | 'storing_started'
  | 'storing_completed'
  | 'ingestion_completed'
  | 'ingestion_failed'
  | 'document_deleted'
  | 'query_started'
  | 'query_embedding_started'
  | 'query_embedded'
  | 'retrieval_started'
  | 'chunks_retrieved'
  | 'reranking_started'
  | 'reranking_completed'
  | 'generation_started'
  | 'generation_token'
  | 'generation_completed'
  | 'query_failed'
  | 'pong';

export interface WSMessage {
  event: WSEventType;
  document_id?: string;
  query_id?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export type PipelineStage =
  | 'idle'
  | 'upload'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'complete'
  | 'error';

export type QueryStage =
  | 'idle'
  | 'embedding'
  | 'retrieving'
  | 'reranking'
  | 'generating'
  | 'complete'
  | 'error';

export interface PipelineState {
  stage: PipelineStage;
  document_id?: string;
  filename?: string;
  total_chunks: number;
  embedded_chunks: number;
  progress: number;
  error?: string;
}

export interface QueryState {
  stage: QueryStage;
  query_id?: string;
  question?: string;
  sources: SourceChunk[];
  streamingAnswer: string;
  processingTime?: number;
}

export interface EventLogEntry {
  id: string;
  event: WSEventType;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
}
