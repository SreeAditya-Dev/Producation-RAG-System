import { useEffect } from 'react';
import { Bot, Radio, RotateCcw, SearchCheck } from 'lucide-react';
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
    const handler = () => {
      clearLog();
    };

    window.addEventListener('rag:refresh', handler);
    return () => window.removeEventListener('rag:refresh', handler);
  }, [clearLog]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-border bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.15),transparent_24%),linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-card sm:p-8">
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-purple/20 bg-accent-purple/10 px-3 py-1 text-xs font-medium text-accent-purple-light">
                <Bot size={12} />
                Conversational retrieval layer
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                Ask complex questions and watch the answer build in real time.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                The query experience foregrounds source retrieval, streaming generation, and system visibility so each answer feels inspectable rather than opaque.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                { icon: SearchCheck, label: 'Current stage', value: queryState.stage },
                { icon: Radio, label: 'WebSocket', value: connected ? 'Live' : 'Reconnecting' },
                { icon: RotateCcw, label: 'Reload ready', value: 'Yes' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-border bg-black/20 p-4">
                  <Icon size={16} className="text-accent-cyan" />
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-text-muted">{label}</p>
                  <p className="mt-1 text-lg font-semibold capitalize text-text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="overflow-hidden rounded-[24px] border border-border bg-bg-card/90 shadow-card xl:col-span-2" style={{ minHeight: '62vh' }}>
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

          <div className="flex min-h-0 flex-col gap-4">
            <QueryVisualizer state={queryState} />
            <div className="min-h-[260px] flex-1">
              <EventLog entries={eventLog} onClear={clearLog} connected={connected} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
