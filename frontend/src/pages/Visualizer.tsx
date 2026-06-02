import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, ScanSearch, Signal, Upload, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { usePipelineCtx } from '../components/layout/Layout';
import { PipelineVisualizer } from '../components/visualizer/PipelineVisualizer';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';
import { EventLog } from '../components/visualizer/EventLog';

export function Visualizer() {
  const { pipeline, queryState, eventLog, clearLog, connected } = usePipelineCtx();

  useEffect(() => {
    const handler = () => clearLog();
    window.addEventListener('rag:refresh', handler);
    return () => window.removeEventListener('rag:refresh', handler);
  }, [clearLog]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="space-y-8">
        <section className="rounded-[28px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_24%),radial-gradient(circle_at_right,rgba(6,182,212,0.14),transparent_24%),linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-card sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
                <Signal size={12} />
                Pipeline telemetry
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                Real-time visualizer for the full ingestion and query path.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                This view is tuned for monitoring: every step, event, and system handoff stays visible, with room to reload the interface or clear the live stream when needed.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div
                className={clsx(
                  'flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-medium',
                  connected ? 'border-accent-green/40 bg-accent-green/10 text-accent-green' : 'border-accent-red/40 bg-accent-red/10 text-accent-red'
                )}
              >
                <Radio size={12} className={connected ? 'animate-pulse' : ''} />
                {connected ? 'Live' : 'Disconnected'}
              </div>
            </div>
          </div>
        </section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-[24px] border border-border bg-bg-card/90 p-6 shadow-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">System Architecture</p>
              <h3 className="text-lg font-semibold text-text-primary">Layer flow</h3>
            </div>
            <ScanSearch size={18} className="text-accent-indigo-light" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {[
              { label: 'Documents', sub: 'PDF, DOCX, TXT, MD', color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30' },
              { label: 'FastAPI', sub: 'Python backend', color: 'from-accent-purple/20 to-accent-purple/10 border-accent-purple/30', arrow: true },
              { label: 'NVIDIA NIM', sub: 'Llama-3.3-70B\nnv-embedqa-e5-v5', color: 'from-green-500/20 to-green-600/20 border-green-500/30', arrow: true },
              { label: 'Pinecone', sub: 'Vector DB\n1024-dim cosine', color: 'from-accent-blue/20 to-accent-blue/10 border-accent-blue/30', arrow: true },
              { label: 'React UI', sub: 'TypeScript\nTailwindCSS', color: 'from-orange-500/20 to-orange-600/20 border-orange-500/30', arrow: true },
            ].map((node, i) => (
              <div key={i} className="flex items-center gap-2">
                {node.arrow && <div className="h-px w-6 bg-gradient-to-r from-border to-border-light" />}
                <div className={`min-w-[110px] rounded-xl border bg-gradient-to-br px-4 py-3 text-center ${node.color}`}>
                  <p className="text-xs font-semibold text-text-primary">{node.label}</p>
                  <p className="mt-0.5 whitespace-pre-line text-xs leading-tight text-text-muted">{node.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ══════════════════════════════════════
            SECTION 01 · INGESTION PIPELINE
        ══════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-[28px] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.05] via-transparent to-transparent shadow-[0_0_0_1px_rgba(59,130,246,0.06),0_8px_48px_rgba(59,130,246,0.08)]"
        >
          {/* Banner header */}
          <div className="relative overflow-hidden border-b border-blue-500/15 bg-gradient-to-r from-blue-500/10 via-blue-400/5 to-transparent px-6 py-5">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-400/8 blur-2xl" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/15">
                  <Upload size={20} className="text-blue-400" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-blue-500/40 bg-bg-primary text-[9px] font-black text-blue-400">01</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-blue-400/60">Stage 01</span>
                    <span className="h-px w-4 bg-blue-400/20" />
                    <span className="text-[10px] text-text-muted">5 steps · Upload → Parse → Chunk → Embed → Store</span>
                  </div>
                  <h3 className="mt-0.5 text-lg font-bold text-text-primary">Ingestion Pipeline</h3>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
                </span>
                <span className="text-xs font-semibold text-blue-300">Document Processing</span>
              </div>
            </div>
          </div>
          {/* Component */}
          <PipelineVisualizer state={pipeline} hideHeader />
        </motion.section>

        {/* ══════════════════════════════════════
            SECTION 02 · QUERY PIPELINE
        ══════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="overflow-hidden rounded-[28px] border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.05] via-transparent to-transparent shadow-[0_0_0_1px_rgba(168,85,247,0.06),0_8px_48px_rgba(168,85,247,0.08)]"
        >
          {/* Banner header */}
          <div className="relative overflow-hidden border-b border-purple-500/15 bg-gradient-to-r from-purple-500/10 via-purple-400/5 to-transparent px-6 py-5">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-400/8 blur-2xl" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/15">
                  <Sparkles size={20} className="text-purple-400" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-purple-500/40 bg-bg-primary text-[9px] font-black text-purple-400">02</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-purple-400/60">Stage 02</span>
                    <span className="h-px w-4 bg-purple-400/20" />
                    <span className="text-[10px] text-text-muted">7 stages · Query → Embed → Retrieve → Rerank → LLM → Answer</span>
                  </div>
                  <h3 className="mt-0.5 text-lg font-bold text-text-primary">Query Pipeline</h3>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/8 px-4 py-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-400" />
                </span>
                <span className="text-xs font-semibold text-purple-300">Retrieval & Generation</span>
              </div>
            </div>
          </div>
          {/* Component */}
          <QueryVisualizer state={queryState} hideHeader />
        </motion.section>

        <div style={{ height: '320px' }}>
          <EventLog entries={eventLog} onClear={clearLog} connected={connected} />
        </div>
        </div>
    </div>
  );
}
