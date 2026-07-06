import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useRAG } from '../hooks/useRAG';
import { usePipelineCtx } from '../components/layout/Layout';
import { ChatInterface } from '../components/query/ChatInterface';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';
import { EventLog } from '../components/visualizer/EventLog';

export function Query() {
  const { query } = useRAG();
  const { queryState, eventLog, clearLog, connected } = usePipelineCtx();
  const [logCollapsed, setLogCollapsed] = useState(false);

  const isLoading = ['embedding', 'retrieving', 'generating'].includes(queryState.stage);

  useEffect(() => {
    const handler = () => clearLog();
    window.addEventListener('rag:refresh', handler);
    return () => window.removeEventListener('rag:refresh', handler);
  }, [clearLog]);

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-[#09090b]">
      {/* ── Left panel: Chat ── */}
      <div className="flex flex-1 min-w-0 flex-col border-r border-zinc-800">
        <ChatInterface
          onQuery={async (q, topK) => {
            const result = await query(q, topK);
            return result;
          }}
          streamingAnswer={queryState.streamingAnswer}
          isLoading={isLoading}
          stage={queryState.stage}
        />
      </div>

      {/* ── Right panel: Pipeline flow + Event log ── */}
      <div className="flex w-[460px] shrink-0 flex-col bg-[#0c0c0e] xl:w-[500px]">
        {/* Status bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 shrink-0 bg-[#0c0c0e]">
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Online</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Offline</span>
              </>
            )}
            <span className="text-zinc-700 font-mono text-[9px]">&middot;</span>
            <span className="text-[10px] font-mono text-zinc-400 capitalize">{queryState.stage}</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Answer Studio
          </span>
        </div>

        {/* Pipeline flow (grows to fill) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <QueryVisualizer state={queryState} />
        </div>

        {/* Event log (dynamic height) */}
        <div className={clsx(
          "shrink-0 border-t border-zinc-800 transition-all duration-300 ease-in-out",
          logCollapsed ? "h-[41px]" : "h-[220px]"
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
