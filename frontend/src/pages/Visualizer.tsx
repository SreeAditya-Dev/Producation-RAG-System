import { usePipelineCtx } from '../components/layout/Layout';
import { PipelineVisualizer } from '../components/visualizer/PipelineVisualizer';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';
import { EventLog } from '../components/visualizer/EventLog';
import { motion } from 'framer-motion';
import { Activity, Radio, Wifi } from 'lucide-react';
import { clsx } from 'clsx';

export function Visualizer() {
  const { pipeline, queryState, eventLog, clearLog, connected } = usePipelineCtx();

  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Real-Time Visualizer</h1>
          <p className="text-text-muted text-sm mt-1">Live view of ingestion and query pipelines</p>
        </div>
        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium',
          connected
            ? 'border-accent-green/40 text-accent-green bg-accent-green/10'
            : 'border-accent-red/40 text-accent-red bg-accent-red/10'
        )}>
          <Radio size={12} className={connected ? 'animate-pulse' : ''} />
          {connected ? 'Live' : 'Disconnected'}
        </div>
      </div>

      {/* Architecture diagram */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-bg-card border border-border rounded-2xl p-6"
      >
        <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-6">System Architecture</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {[
            { label: 'Documents', sub: 'PDF, DOCX, TXT, MD', color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30' },
            { label: 'FastAPI', sub: 'Python backend', color: 'from-accent-purple/20 to-accent-purple/10 border-accent-purple/30', arrow: true },
            { label: 'NVIDIA NIM', sub: 'Llama-3.3-70B\nnv-embedqa-e5-v5', color: 'from-green-500/20 to-green-600/20 border-green-500/30', arrow: true },
            { label: 'Pinecone', sub: 'Vector DB\n1024-dim cosine', color: 'from-accent-cyan/20 to-accent-cyan/10 border-accent-cyan/30', arrow: true },
            { label: 'React UI', sub: 'TypeScript\nTailwindCSS', color: 'from-orange-500/20 to-orange-600/20 border-orange-500/30', arrow: true },
          ].map((node, i) => (
            <div key={i} className="flex items-center gap-2">
              {node.arrow && (
                <div className="w-6 h-px bg-gradient-to-r from-border to-border-light" />
              )}
              <div className={`px-4 py-3 bg-gradient-to-br ${node.color} border rounded-xl text-center min-w-[100px]`}>
                <p className="text-text-primary text-xs font-semibold">{node.label}</p>
                <p className="text-text-muted text-xs mt-0.5 whitespace-pre-line leading-tight">{node.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Live pipelines */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wide px-1">Ingestion Pipeline</p>
          <PipelineVisualizer state={pipeline} />
        </div>
        <div className="space-y-2">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wide px-1">Query Pipeline</p>
          <QueryVisualizer state={queryState} />
        </div>
      </div>

      {/* Event log */}
      <div style={{ height: '320px' }}>
        <EventLog entries={eventLog} onClear={clearLog} connected={connected} />
      </div>
    </div>
  );
}
