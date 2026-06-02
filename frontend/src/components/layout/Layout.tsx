import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { usePipelineState } from '../../hooks/usePipelineState';
import { createContext, useContext } from 'react';
import type { PipelineState, QueryState, EventLogEntry } from '../../types';

interface PipelineContext {
  pipeline: PipelineState;
  queryState: QueryState;
  eventLog: EventLogEntry[];
  connected: boolean;
  clearLog: () => void;
  resetPipeline: () => void;
  resetQuery: () => void;
}

const PipelineCtx = createContext<PipelineContext | null>(null);

export function usePipelineCtx() {
  const ctx = useContext(PipelineCtx);
  if (!ctx) throw new Error('usePipelineCtx must be inside Layout');
  return ctx;
}

export function Layout() {
  const state = usePipelineState();

  return (
    <PipelineCtx.Provider value={state}>
      <div className="flex h-screen bg-bg-primary overflow-hidden">
        <Sidebar connected={state.connected} />
        <main className="flex-1 overflow-y-auto bg-bg-primary bg-grid-pattern bg-grid">
          <Outlet />
        </main>
      </div>
    </PipelineCtx.Provider>
  );
}
