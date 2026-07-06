import { useEffect } from 'react';
import { Radio, Wifi, WifiOff } from 'lucide-react';
import { useRAG } from '../hooks/useRAG';
import { usePipelineCtx } from '../components/layout/Layout';
import { ChatInterface } from '../components/query/ChatInterface';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';
import { EventLog } from '../components/visualizer/EventLog';

export function Query() {
  const { query } = useRAG();
  const { queryState, eventLog, clearLog, connected } = usePipelineCtx();

  const isLoading = ['embedding', 'retrieving', 'generating'].includes(queryState.stage);

  useEffect(() => {
    const handler = () => clearLog();
    window.addEventListener('rag:refresh', handler);
    return () => window.removeEventListener('rag:refresh', handler);
  }, [clearLog]);

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden">
      {/* ── Left panel: Chat ── */}
      <div className="flex flex-1 min-w-0 flex-col border-r border-[#1e1e24]">
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
        <div className="flex items-center justify-between border-b border-[#1e1e24] px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] font-semibold text-emerald-400">Live Connection</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="text-[11px] font-semibold text-red-400">Disconnected</span>
              </>
            )}
            <span className="mx-1 text-[#52525b] text-xs">·</span>
            <span className="text-[11px] text-[#71717a] capitalize">{queryState.stage}</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#52525b]">
            Answer Studio
          </span>
        </div>

        {/* Pipeline flow (grows to fill) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <QueryVisualizer state={queryState} />
        </div>

        {/* Event log (fixed height at bottom) */}
        <div className="h-[200px] shrink-0 border-t border-[#1e1e24]">
          <EventLog entries={eventLog} onClear={clearLog} connected={connected} />
        </div>
      </div>
    </div>
  );
}
