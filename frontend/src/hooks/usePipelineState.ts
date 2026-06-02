import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type {
  PipelineState,
  QueryState,
  EventLogEntry,
  WSMessage,
} from '../types';

function makeLogEntry(
  event: string,
  msg: string,
  type: EventLogEntry['type']
): EventLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    event: event as EventLogEntry['event'],
    message: msg,
    timestamp: new Date().toISOString(),
    type,
  };
}

const INITIAL_PIPELINE: PipelineState = {
  stage: 'idle',
  total_chunks: 0,
  embedded_chunks: 0,
  progress: 0,
};

const INITIAL_QUERY: QueryState = {
  stage: 'idle',
  sources: [],
  streamingAnswer: '',
};

export function usePipelineState() {
  const { on, connected } = useWebSocket();
  const [pipeline, setPipeline] = useState<PipelineState>(INITIAL_PIPELINE);
  const [queryState, setQueryState] = useState<QueryState>(INITIAL_QUERY);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);

  const addLog = useCallback((entry: EventLogEntry) => {
    setEventLog((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    const unsub = on('*', (msg: WSMessage) => {
      const { event, data, document_id, query_id } = msg;

      switch (event) {
        // ── Ingestion ──────────────────────────────────────────────────────
        case 'ingestion_started':
          setPipeline({
            stage: 'upload',
            document_id,
            filename: (data as Record<string, string>).filename,
            total_chunks: 0,
            embedded_chunks: 0,
            progress: 0,
          });
          addLog(makeLogEntry(event, `Ingestion started: ${(data as Record<string, string>).filename}`, 'info'));
          break;

        case 'parsing_started':
          setPipeline((p) => ({ ...p, stage: 'parsing' }));
          addLog(makeLogEntry(event, 'Parsing document...', 'info'));
          break;

        case 'parsing_completed':
          addLog(makeLogEntry(event, `Parsed ${(data as Record<string, number>).char_count?.toLocaleString()} characters`, 'success'));
          break;

        case 'chunking_started':
          setPipeline((p) => ({ ...p, stage: 'chunking' }));
          addLog(makeLogEntry(event, 'Splitting into chunks...', 'info'));
          break;

        case 'chunking_completed':
          setPipeline((p) => ({
            ...p,
            total_chunks: (data as Record<string, number>).total_chunks || 0,
          }));
          addLog(makeLogEntry(event, `Created ${(data as Record<string, number>).total_chunks} chunks`, 'success'));
          break;

        case 'embedding_started':
          setPipeline((p) => ({ ...p, stage: 'embedding' }));
          addLog(makeLogEntry(event, `Generating embeddings for ${(data as Record<string, number>).total_chunks} chunks...`, 'info'));
          break;

        case 'chunk_embedded': {
          const d = data as Record<string, number>;
          setPipeline((p) => ({
            ...p,
            embedded_chunks: (d.chunk_index || 0) + 1,
            progress: d.progress || 0,
          }));
          break;
        }

        case 'storing_started':
          setPipeline((p) => ({ ...p, stage: 'storing' }));
          addLog(makeLogEntry(event, `Storing ${(data as Record<string, number>).vector_count} vectors in Pinecone...`, 'info'));
          break;

        case 'storing_completed':
          addLog(makeLogEntry(event, `Stored ${(data as Record<string, number>).upserted} vectors`, 'success'));
          break;

        case 'ingestion_completed':
          setPipeline((p) => ({ ...p, stage: 'complete', progress: 100 }));
          addLog(makeLogEntry(event, `✓ Ingestion complete: ${(data as Record<string, string | number>).chunk_count} chunks indexed`, 'success'));
          setTimeout(() => setPipeline(INITIAL_PIPELINE), 5000);
          break;

        case 'ingestion_failed':
          setPipeline((p) => ({ ...p, stage: 'error', error: (data as Record<string, string>).error }));
          addLog(makeLogEntry(event, `✗ Ingestion failed: ${(data as Record<string, string>).error}`, 'error'));
          break;

        case 'document_deleted':
          addLog(makeLogEntry(event, `Document deleted: ${document_id}`, 'warning'));
          break;

        // ── Query ──────────────────────────────────────────────────────────
        case 'query_started':
          setQueryState({
            stage: 'embedding',
            query_id,
            question: (data as Record<string, string>).question,
            sources: [],
            streamingAnswer: '',
          });
          addLog(makeLogEntry(event, `Query: "${(data as Record<string, string>).question?.slice(0, 80)}..."`, 'info'));
          break;

        case 'query_embedded':
          setQueryState((q) => ({ ...q, stage: 'retrieving' }));
          addLog(makeLogEntry(event, 'Query embedded, searching vector DB...', 'info'));
          break;

        case 'chunks_retrieved': {
          const d = data as Record<string, unknown>;
          setQueryState((q) => ({ ...q, stage: 'generating' }));
          addLog(makeLogEntry(event, `Retrieved ${d.count} relevant chunks`, 'success'));
          break;
        }

        case 'generation_started':
          setQueryState((q) => ({ ...q, stage: 'generating' }));
          addLog(makeLogEntry(event, `Generating answer with ${(data as Record<string, string>).model}...`, 'info'));
          break;

        case 'generation_token':
          setQueryState((q) => ({
            ...q,
            streamingAnswer: q.streamingAnswer + ((data as Record<string, string>).token || ''),
          }));
          break;

        case 'generation_completed': {
          const d = data as Record<string, unknown>;
          const sources = (d.sources as QueryState['sources']) || [];
          setQueryState((q) => ({
            ...q,
            stage: 'complete',
            sources,
            processingTime: d.processing_time as number,
            streamingAnswer: (d.answer as string) || q.streamingAnswer,
          }));
          addLog(makeLogEntry(event, `✓ Answer generated in ${(d.processing_time as number)?.toFixed(2)}s`, 'success'));
          break;
        }

        case 'query_failed':
          setQueryState((q) => ({
            ...q,
            stage: 'error',
          }));
          addLog(makeLogEntry(event, `✗ Query failed: ${(data as Record<string, string>).error}`, 'error'));
          break;
      }
    });

    return unsub;
  }, [on, addLog]);

  const clearLog = useCallback(() => setEventLog([]), []);
  const resetPipeline = useCallback(() => setPipeline(INITIAL_PIPELINE), []);
  const resetQuery = useCallback(() => setQueryState(INITIAL_QUERY), []);

  return {
    pipeline,
    queryState,
    eventLog,
    connected,
    clearLog,
    resetPipeline,
    resetQuery,
  };
}
