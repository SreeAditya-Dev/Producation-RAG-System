import { useState, useCallback } from 'react';
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

const initialState: RAGState = {
  stage: 'idle',
  answer: '',
  sources: [],
};

export function useRAG() {
  const [state, setState] = useState<RAGState>(initialState);
  const [history, setHistory] = useState<QueryResponse[]>([]);

  const query = useCallback(async (question: string, topK = 5) => {
    setState({ stage: 'embedding', answer: '', sources: [], error: undefined });

    try {
      const { data } = await queryApi.query(question, topK);

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
      setState((prev) => ({ ...prev, stage: 'error', error: message }));
      toast.error(message);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { ...state, query, reset, history };
}
