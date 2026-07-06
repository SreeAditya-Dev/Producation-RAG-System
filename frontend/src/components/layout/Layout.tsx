import { Outlet, useLocation } from 'react-router-dom';
import { createContext, useContext, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Wifi, WifiOff, X } from 'lucide-react';
import { clsx } from 'clsx';
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
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

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
      <div className="relative flex min-h-screen overflow-hidden bg-[#09090b]">
        <div className="fixed inset-y-0 left-0 z-20 hidden lg:block">
          <Sidebar 
            connected={state.connected} 
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
          />
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

        <main className={clsx(
          "relative flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300",
          collapsed ? "lg:ml-20" : "lg:ml-[280px]"
        )}>
          <header className="sticky top-0 z-30 border-b border-[#1e1e24] bg-[#0c0c0e]/95 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#1e1e24] bg-[#121215] text-[#8b8b9f] transition hover:border-[#272730] hover:text-white lg:hidden"
                >
                  <Menu size={18} />
                </button>

                <div className="flex items-center gap-2 text-sm text-[#8b8b9f]">
                  <span className="font-semibold text-white">{pageMeta.title}</span>
                </div>
              </div>

              {/* Right Side Header Items: Search Bar & Icons */}
              <div className="flex items-center gap-4">
                {/* Search Bar matching screenshot */}
                <div className="relative hidden md:flex items-center">
                  <span className="absolute left-3 text-[#52525b]">&para;</span>
                  <input
                    type="text"
                    placeholder="Search query, metrics..."
                    disabled
                    className="w-64 pl-8 pr-12 py-1.5 text-xs bg-[#121215] border border-[#1e1e24] rounded-lg text-white placeholder-[#52525b] focus:outline-none cursor-not-allowed"
                  />
                  <span className="absolute right-3 px-1.5 py-0.5 text-[9px] bg-[#1c1c20] text-[#71717a] border border-[#272730] rounded font-mono">
                    Ctrl K
                  </span>
                </div>

                {/* Connection Status indicator styled like a widget in layout */}
                <div className="flex items-center gap-2 rounded-lg border border-[#1e1e24] bg-[#121215] px-3 py-1.5 text-xs text-[#8b8b9f]">
                  {state.connected ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      </span>
                      <span>System Online</span>
                    </>
                  ) : (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
                      </span>
                      <span>Offline</span>
                    </>
                  )}
                </div>
                {sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#1e1e24] bg-[#121215] text-[#8b8b9f] transition hover:border-[#272730] hover:text-white lg:hidden"
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
