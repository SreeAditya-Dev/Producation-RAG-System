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
      <div className="flex flex-1 min-w-0 flex-col border-r border-border">
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
      <div className="flex w-[460px] shrink-0 flex-col bg-bg-secondary/50 xl:w-[500px]">
        {/* Status bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
                </span>
                <Wifi size={11} className="text-accent-green" />
                <span className="text-[11px] font-medium text-accent-green">Live</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-accent-red" />
                <WifiOff size={11} className="text-accent-red" />
                <span className="text-[11px] font-medium text-accent-red">Offline</span>
              </>
            )}
            <span className="mx-1 text-text-dim text-xs">·</span>
            <Radio size={11} className="text-text-muted" />
            <span className="text-[11px] text-text-muted capitalize">{queryState.stage}</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">
            Answer Studio
          </span>
        </div>

        {/* Pipeline flow (grows to fill) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <QueryVisualizer state={queryState} />
        </div>

        {/* Event log (fixed height at bottom) */}
        <div className="h-[200px] shrink-0 border-t border-border">
          <EventLog entries={eventLog} onClear={clearLog} connected={connected} />
        </div>
      </div>
    </div>
  );
}
