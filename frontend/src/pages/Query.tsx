import { useRAG } from '../hooks/useRAG';
import { usePipelineCtx } from '../components/layout/Layout';
import { ChatInterface } from '../components/query/ChatInterface';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';
import { EventLog } from '../components/visualizer/EventLog';

export function Query() {
  const { query, stage } = useRAG();
  const { queryState, eventLog, clearLog, connected } = usePipelineCtx();

  const isLoading = ['embedding', 'retrieving', 'generating'].includes(queryState.stage);

  return (
    <div className="h-full flex flex-col px-8 py-8 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Query</h1>
        <p className="text-text-muted text-sm mt-1">Ask questions about your documents</p>
      </div>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6 min-h-0">
        {/* Chat */}
        <div className="xl:col-span-2 bg-bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ height: '70vh' }}>
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

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          <QueryVisualizer state={queryState} />
          <div className="flex-1" style={{ minHeight: '200px' }}>
            <EventLog entries={eventLog} onClear={clearLog} connected={connected} />
          </div>
        </div>
      </div>
    </div>
  );
}
