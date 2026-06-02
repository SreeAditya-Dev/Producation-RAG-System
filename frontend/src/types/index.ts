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
  question: string;
  answer: string;
  sources: SourceChunk[];
  processing_time: number;
  created_at: string;
}

export interface QueryHistoryItem extends QueryResponse {}

export interface StatsResponse {
  total_documents: number;
  total_chunks: number;
  total_queries: number;
  index_stats: {
    total_vector_count?: number;
    dimension?: number;
    status?: string;
    hnsw?: { m: number; ef_construct: number; ef: number };
  };
}

export interface HealthResponse {
  status: string;
  qdrant: string;
  nvidia: string;
  version: string;
}

// WebSocket event types
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
