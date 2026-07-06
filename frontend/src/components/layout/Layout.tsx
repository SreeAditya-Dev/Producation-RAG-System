import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  Wifi, 
  WifiOff, 
  X, 
  Search, 
  FileText, 
  MessageSquare, 
  Terminal, 
  Upload, 
  Columns, 
  Trash2, 
  Sparkles, 
  CornerDownLeft,
  BookOpen
} from 'lucide-react';
import { clsx } from 'clsx';
import { Sidebar } from './Sidebar';
import { usePipelineState } from '../../hooks/usePipelineState';
import type { PipelineState, QueryState, EventLogEntry } from '../../types';
import { useQuery } from '@tanstack/react-query';
import { documentsApi, queryApi } from '../../services/api';
import toast from 'react-hot-toast';

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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // Fetch documents and query history for search matches
  const { data: docsData } = useQuery({
    queryKey: ['documentsList'],
    queryFn: () => documentsApi.list().then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: queryHistory } = useQuery({
    queryKey: ['queryHistory'],
    queryFn: () => queryApi.history(10).then((r) => r.data),
    staleTime: 30_000,
  });

  // Base commands list
  const baseCommands = useMemo(() => [
    { id: 'nav-dashboard', title: 'Go to Dashboard', category: 'Navigation', icon: Menu, action: () => navigate('/') },
    { id: 'nav-documents', title: 'Go to Document Control', category: 'Navigation', icon: FileText, action: () => navigate('/documents') },
    { id: 'nav-query', title: 'Go to Answer Studio', category: 'Navigation', icon: MessageSquare, action: () => navigate('/query') },
    { id: 'nav-visualizer', title: 'Go to Live Pipeline View', category: 'Navigation', icon: Terminal, action: () => navigate('/visualizer') },
    { id: 'nav-docs', title: 'Go to System Documentation', category: 'Navigation', icon: BookOpen, action: () => navigate('/docs') },
    { id: 'act-upload', title: 'Upload Document Payload', category: 'Actions', icon: Upload, action: () => navigate('/documents') },
    { id: 'act-ask', title: 'Open Query Studio', category: 'Actions', icon: Sparkles, action: () => navigate('/query') },
    { id: 'act-clear-log', title: 'Clear Telemetry Logs', category: 'Actions', icon: Trash2, action: () => { state.clearLog(); toast.success('Telemetry logs cleared'); } },
    { id: 'act-collapse', title: 'Toggle Sidebar Collapse', category: 'Actions', icon: Columns, action: () => toggleCollapse() },
  ], [navigate, state]);

  // Combine commands, documents, and past queries
  const allItems = useMemo(() => {
    const queryItems = (queryHistory?.queries ?? []).map((q: any) => ({
      id: `query-${q.query_id}`,
      title: `Ask Query: "${q.question}"`,
      category: 'Recent Queries',
      icon: MessageSquare,
      action: () => navigate('/query', { state: { initialQuestion: q.question } })
    }));

    return [...baseCommands, ...queryItems];
  }, [baseCommands, queryHistory, navigate]);

  // Filter based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery) return allItems;
    const cleanSearch = searchQuery.toLowerCase();
    return allItems.filter(item => 
      item.title.toLowerCase().includes(cleanSearch) || 
      item.category.toLowerCase().includes(cleanSearch)
    );
  }, [searchQuery, allItems]);

  // Handle Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus input when palette opens
  useEffect(() => {
    if (commandPaletteOpen) {
      setSearchQuery('');
      setTimeout(() => commandPaletteInputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  const handlePaletteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        setCommandPaletteOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCommandPaletteOpen(false);
    }
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
      case '/docs':
        return {
          title: 'System Documentation',
          subtitle: 'Detailed explanation of the RAG architecture, retrieval pipeline, and active stack services.',
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
        <div className="fixed inset-y-0 left-0 z-20 hidden lg:block pointer-events-none">
          <div className="h-full pointer-events-auto">
            <Sidebar 
              connected={state.connected} 
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
            />
          </div>
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
          collapsed ? "lg:ml-[108px]" : "lg:ml-[292px]"
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
                <div 
                  onClick={() => setCommandPaletteOpen(true)}
                  className="relative hidden md:flex items-center cursor-pointer hover:border-white/10 transition-all duration-200"
                >
                  <span className="absolute left-3 text-[#52525b]">&para;</span>
                  <input
                    type="text"
                    placeholder="Search query, metrics..."
                    readOnly
                    className="w-64 pl-8 pr-12 py-1.5 text-xs bg-[#121215] border border-[#1e1e24] rounded-lg text-white placeholder-[#52525b] focus:outline-none cursor-pointer"
                  />
                  <span className="absolute right-3 px-1.5 py-0.5 text-[9px] bg-[#1c1c20] text-[#71717a] border border-[#272730] rounded font-mono select-none">
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

      {/* Global Command Palette Modal */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommandPaletteOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed inset-x-4 top-[10vh] mx-auto z-50 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c0c0e]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
            >
              {/* Input header */}
              <div className="relative flex items-center border-b border-white/5 px-4 py-3 shrink-0">
                <Search size={16} className="text-slate-500 mr-3" />
                <input
                  ref={commandPaletteInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handlePaletteKeyDown}
                  placeholder="Search queries, documents, settings..."
                  className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => setCommandPaletteOpen(false)}
                  className="text-[10px] bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 px-2 py-0.5 rounded border border-white/5 font-mono"
                >
                  ESC
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-2 min-h-0 space-y-3 scrollbar-thin">
                {filteredItems.length > 0 ? (
                  // Group items by category
                  Object.entries(
                    filteredItems.reduce((groups, item) => {
                      const group = groups[item.category] || [];
                      group.push(item);
                      groups[item.category] = group;
                      return groups;
                    }, {} as Record<string, typeof filteredItems>)
                  ).map(([category, items]) => (
                    <div key={category} className="space-y-1">
                      <div className="px-3 py-1 text-[8px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                        {category}
                      </div>
                      {items.map((item) => {
                        const globalIndex = filteredItems.findIndex(fi => fi.id === item.id);
                        const isSelected = globalIndex === selectedIndex;
                        const Icon = item.icon;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              item.action();
                              setCommandPaletteOpen(false);
                            }}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={clsx(
                              "flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer",
                              isSelected 
                                ? "bg-white/[0.04] text-white border-l-2 border-orange-500 rounded-l-none pl-[10px]" 
                                : "text-slate-350 hover:bg-white/[0.02] hover:text-white"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Icon size={14} className={clsx(isSelected ? "text-orange-500" : "text-slate-500")} />
                              <span className="truncate font-medium">{item.title}</span>
                            </div>
                            {isSelected && (
                              <div className="flex items-center gap-1 text-[9px] text-slate-500 font-mono">
                                <span>Select</span>
                                <CornerDownLeft size={10} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-slate-500 font-mono">
                    No results found for "{searchQuery}"
                  </div>
                )}
              </div>

              {/* Footer controls hints */}
              <div className="px-4 py-2 bg-white/[0.01] border-t border-white/5 flex items-center justify-between text-[8px] text-slate-500 font-mono shrink-0">
                <div className="flex items-center gap-2.5">
                  <span>&uarr;&darr; to navigate</span>
                  <span>&bull;</span>
                  <span>Enter to select</span>
                  <span>&bull;</span>
                  <span>Esc to exit</span>
                </div>
                <div className="text-slate-600 font-semibold uppercase">
                  RAG MISSION CONTROL
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PipelineCtx.Provider>
  );
}
