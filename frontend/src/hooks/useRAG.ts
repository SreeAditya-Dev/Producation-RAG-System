import { useState, useCallback, useRef } from 'react';
import { queryApi } from '../services/api';
import type { QueryResponse, SourceChunk, QueryStage } from '../types';
import toast from 'react-hot-toast';

interface RAGState {
  stage: QueryStage;
  answer: string;
  sources: SourceChunk[];
  processingTime?: number;
  queryId?: string;
  error?: string;
}

interface RAGOptions {
  /**
   * Whether the answer for the in-flight query already arrived by another route
   * — in practice the WebSocket stream, which completes independently of the
   * POST. When it has, an HTTP-level failure is not the user's problem: the
   * answer is on screen, and toasting an error beside it is just wrong.
   */
  answerDeliveredOutOfBand?: () => boolean;
}

const initialState: RAGState = {
  stage: 'idle',
  answer: '',
  sources: [],
};

export function useRAG(options: RAGOptions = {}) {
  const [state, setState] = useState<RAGState>(initialState);
  const [history, setHistory] = useState<QueryResponse[]>([]);
  // `query` is memoized with no deps, so it would close over the first render's
  // options. Read them through a ref that every render refreshes instead.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const query = useCallback(async (question: string, topK = 5, sessionId?: string) => {
    setState({ stage: 'embedding', answer: '', sources: [], error: undefined });

    try {
      const { data } = await queryApi.query(question, topK, sessionId);

      setState({
        stage: 'complete',
        answer: data.answer,
        sources: data.sources,
        processingTime: data.processing_time,
        queryId: data.query_id,
      });

      setHistory((prev) => [data, ...prev.slice(0, 49)]);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      if (optionsRef.current.answerDeliveredOutOfBand?.()) {
        setState((prev) => ({ ...prev, stage: 'complete' }));
      } else {
        setState((prev) => ({ ...prev, stage: 'error', error: message }));
        toast.error(message);
      }
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { ...state, query, reset, history };
}
