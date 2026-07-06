import { Outlet, useLocation } from 'react-router-dom';
import { createContext, useContext, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Wifi, WifiOff, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { usePipelineState } from '../../hooks/usePipelineState';
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
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageMeta = useMemo(() => {
    switch (location.pathname) {
      case '/documents':
        return {
          title: 'Document Control',
          subtitle: 'Upload, process, and track each ingestion layer with live status.',
        };
      case '/query':
        return {
          title: 'Answer Studio',
          subtitle: 'Inspect retrieval, sources, and generation as responses stream in.',
        };
      case '/visualizer':
        return {
          title: 'Pipeline Live View',
          subtitle: 'Follow ingestion and query execution with a real-time telemetry surface.',
        };
      default:
        return {
          title: 'RAG Mission Control',
          subtitle: 'A dynamic workspace for documents, retrieval, embeddings, and answers.',
        };
    }
  }, [location.pathname]);

  return (
    <PipelineCtx.Provider value={state}>
      <div className="relative flex min-h-screen overflow-hidden bg-bg-primary">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-60" />
        {/* Minimal background effects */}
        <div className="pointer-events-none absolute right-0 bottom-0 h-96 w-96 rounded-full bg-accent-primary/5 blur-3xl" />

        <div className="fixed inset-y-0 left-0 z-20 hidden lg:block">
          <Sidebar connected={state.connected} />
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Close navigation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              />
              <motion.div
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="fixed inset-y-0 left-0 z-50 lg:hidden"
              >
                <Sidebar connected={state.connected} mobile onNavigate={() => setSidebarOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-72">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-bg-primary/85 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-bg-card text-text-secondary transition hover:border-border-light hover:text-text-primary lg:hidden"
                >
                  <Menu size={18} />
                </button>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-primary">
                    Control Layer
                  </p>
                  <h1 className="truncate text-lg font-semibold text-text-primary sm:text-2xl">
                    {pageMeta.title}
                  </h1>
                  <p className="truncate text-sm text-text-secondary max-w-[200px] xs:max-w-[300px] sm:max-w-none">
                    {pageMeta.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden items-center gap-2 rounded-2xl border border-border bg-bg-card/80 px-3 py-2 text-xs text-text-secondary md:flex">
                  {state.connected ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-50" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-green" />
                      </span>
                      <Wifi size={13} className="text-accent-green" />
                      Live WebSocket
                    </>
                  ) : (
                    <>
                      <WifiOff size={13} className="text-accent-red" />
                      Reconnecting
                    </>
                  )}
                </div>

{sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-bg-card text-text-secondary transition hover:border-border-light hover:text-text-primary lg:hidden"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] h-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </PipelineCtx.Provider>
  );
}
