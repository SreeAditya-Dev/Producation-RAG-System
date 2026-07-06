import { useEffect, useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRAG } from '../hooks/useRAG';
import { usePipelineCtx } from '../components/layout/Layout';
import { ChatInterface, Message } from '../components/query/ChatInterface';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';
import { EventLog } from '../components/visualizer/EventLog';
import { queryApi } from '../services/api';

export function Query() {
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const { query } = useRAG();
  const { queryState, eventLog, clearLog, connected } = usePipelineCtx();
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  const isLoading = ['embedding', 'retrieving', 'generating'].includes(queryState.stage);

  // Fetch query history to extract sessions
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['queryHistoryList'],
    queryFn: () => queryApi.history(100).then((r) => r.data),
    refetchInterval: 10000,
  });

  // Group queries by session_id
  const sessions = useMemo(() => {
    if (!historyData?.queries) return [];
    
    const groups: Record<string, { sessionId: string; title: string; timestamp: string; queries: any[] }> = {};
    
    // Sort queries chronologically to find the first question for the title
    const sortedQueries = [...historyData.queries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedQueries.forEach((q) => {
      const sId = q.session_id || 'unknown';
      if (!groups[sId]) {
        groups[sId] = {
          sessionId: sId,
          title: q.question.length > 26 ? q.question.substring(0, 26) + '...' : q.question,
          timestamp: q.created_at,
          queries: []
        };
      }
      groups[sId].queries.push(q);
    });

    // Return sessions sorted by latest query timestamp descending
    return Object.values(groups).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [historyData]);

  // Sync messages when current session or history changes
  useEffect(() => {
    if (!currentSessionId) return;

    const activeSession = sessions.find((s) => s.sessionId === currentSessionId);
    
    if (activeSession) {
      const msgs: Message[] = [];
      activeSession.queries.forEach((q) => {
        msgs.push({
          id: `q-${q.query_id}`,
          role: 'user',
          content: q.question
        });
        msgs.push({
          id: `a-${q.query_id}`,
          role: 'assistant',
          content: q.answer,
          sources: q.sources,
          processingTime: q.processing_time
        });
      });
      setMessages(msgs);
    } else {
      setMessages([]);
    }
  }, [currentSessionId, sessions]);

  useEffect(() => {
    const handler = () => clearLog();
    window.addEventListener('rag:refresh', handler);
    return () => window.removeEventListener('rag:refresh', handler);
  }, [clearLog]);

  return (
    <div className="flex h-[calc(100vh-65px)] w-full overflow-hidden bg-black text-slate-100 font-sans relative">
      
      {/* ── Left Sidebar: Session History ── */}
      <AnimatePresence initial={false}>
        {!historyCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 250, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="shrink-0 border-r border-zinc-900 bg-[#09090b]/90 backdrop-blur-xl flex flex-col h-full overflow-hidden"
          >
            {/* New Chat & Collapse Header */}
            <div className="p-4 border-b border-zinc-900 flex items-center gap-2">
              <button
                onClick={() => {
                  const newId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
                  setCurrentSessionId(newId);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 text-white text-xs font-semibold transition-all duration-200 cursor-pointer"
              >
                <Plus size={13} className="text-orange-500" />
                <span>New Chat</span>
              </button>
              
              <button
                onClick={() => setHistoryCollapsed(true)}
                className="p-2.5 rounded-xl border border-white/5 bg-transparent text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer flex items-center justify-center"
                title="Collapse Sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2.5 mb-2 flex items-center gap-1.5">
                <MessageSquare size={11} className="text-orange-500" />
                <span>Chat History</span>
              </div>

              {sessions.length === 0 ? (
                <div className="text-xs text-zinc-600 px-3 py-4 text-center italic">
                  No chat logs found
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = s.sessionId === currentSessionId;
                  return (
                    <button
                      key={s.sessionId}
                      onClick={() => setCurrentSessionId(s.sessionId)}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-xs font-medium rounded-xl border transition-all duration-200 flex flex-col gap-1 cursor-pointer",
                        isActive
                          ? "bg-orange-500/10 border-orange-500/30 text-white shadow-lg shadow-orange-500/5"
                          : "bg-transparent border-transparent text-[#8b8b9f] hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span className="truncate w-full font-semibold">{s.title}</span>
                      <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-mono">
                        <Clock size={9} />
                        <span>
                          {new Date(s.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} &middot; {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Center panel: Chat (Editorial Stream) ── */}
      <div className="flex flex-1 min-w-0 flex-col border-r border-zinc-900 bg-black relative">
        {/* Floating Expand Sidebar Button when Collapsed */}
        {historyCollapsed && (
          <button
            onClick={() => setHistoryCollapsed(false)}
            className="absolute top-4 left-4 z-10 p-2.5 rounded-xl border border-white/5 bg-[#09090b]/90 text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer shadow-lg backdrop-blur-xl flex items-center justify-center"
            title="Expand Chat History"
          >
            <ChevronRight size={14} className="text-orange-500" />
          </button>
        )}

        <ChatInterface
          onQuery={async (q, topK) => {
            const result = await query(q, topK, currentSessionId);
            setTimeout(() => refetchHistory(), 500);
            return result;
          }}
          messages={messages}
          setMessages={setMessages}
          streamingAnswer={queryState.streamingAnswer}
          isLoading={isLoading}
          stage={queryState.stage}
        />
      </div>

      {/* ── Right panel: Vertical Progress Telemetry + Event Log ── */}
      <div className="flex w-[350px] shrink-0 flex-col bg-[#09090b] xl:w-[380px]">
        {/* Pipeline vertical flow */}
        <div className="flex-1 min-h-0">
          <QueryVisualizer state={queryState} />
        </div>

        {/* Live event logs */}
        <div className={clsx(
          "shrink-0 border-t border-zinc-900 transition-all duration-300 ease-in-out bg-[#09090b]",
          logCollapsed ? "h-10" : "h-[220px]"
        )}>
          <EventLog 
            entries={eventLog} 
            onClear={clearLog} 
            connected={connected} 
            collapsed={logCollapsed}
            onToggleCollapse={() => setLogCollapsed(!logCollapsed)}
          />
        </div>
      </div>

    </div>
  );
}

export default Query;
