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
    <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-black">
      {/* ── Left panel: Chat (Editorial Stream) ── */}
      <div className="flex flex-1 min-w-0 flex-col border-r border-zinc-900 bg-black">
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

      {/* ── Right panel: Vertical Progress Telemetry + Event Log ── */}
      <div className="flex w-[380px] shrink-0 flex-col bg-[#09090b] xl:w-[420px]">
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
