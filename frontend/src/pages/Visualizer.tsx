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
        <section className="rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] p-6 shadow-card">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/5 px-3 py-1 text-xs font-medium text-orange-500">
                <Signal size={12} />
                Pipeline Telemetry
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Real-time visualizer for the full ingestion and query path.
              </h2>
              <p className="mt-3 max-w-2xl text-xs leading-5 text-[#a1a1aa] sm:text-sm">
                Monitor every step, event, and system handoff live. Real-time updates give direct diagnostics of active state transitions.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div
                className={clsx(
                  'flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-medium',
                  connected ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'
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
          className="rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] p-6 shadow-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#71717a]">System Architecture</p>
              <h3 className="text-sm font-semibold text-[#a1a1aa]">Layer flow</h3>
            </div>
            <ScanSearch size={18} className="text-[#a1a1aa]" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {[
              { label: 'Documents', sub: 'PDF, DOCX, TXT, MD', color: 'from-[#18181b] to-[#121215] border-[#27272a]' },
              { label: 'FastAPI', sub: 'Python backend', color: 'from-[#18181b] to-[#121215] border-[#27272a]', arrow: true },
              { label: 'NVIDIA NIM', sub: 'Llama-3.3-70B\nnv-embedqa-e5-v5', color: 'from-[#18181b] to-[#121215] border-[#27272a]', arrow: true },
              { label: 'Pinecone', sub: 'Vector DB\n1024-dim cosine', color: 'from-[#18181b] to-[#121215] border-[#27272a]', arrow: true },
              { label: 'React UI', sub: 'TypeScript\nTailwindCSS', color: 'from-[#18181b] to-[#121215] border-[#27272a]', arrow: true },
            ].map((node, i) => (
              <div key={i} className="flex items-center gap-2">
                {node.arrow && <div className="h-px w-6 bg-[#1c1c1f]" />}
                <div className={`min-w-[110px] rounded-xl border bg-gradient-to-br px-4 py-3 text-center ${node.color}`}>
                  <p className="text-xs font-semibold text-white">{node.label}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[10px] leading-tight text-[#71717a]">{node.sub}</p>
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
          className="overflow-hidden rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] shadow-card"
        >
          {/* Banner header */}
          <div className="relative overflow-hidden border-b border-[#1c1c1f] bg-[#121215] px-6 py-5">
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#1c1c1f] bg-[#0c0c0e]">
                  <Upload size={20} className="text-orange-500" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#1c1c1f] bg-[#09090b] text-[9px] font-black text-orange-500">01</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#71717a]">Stage 01</span>
                    <span className="h-px w-4 bg-[#1c1c1f]" />
                    <span className="text-[10px] text-[#71717a]">5 steps · Upload → Parse → Chunk → Embed → Store</span>
                  </div>
                  <h3 className="mt-0.5 text-base font-bold text-white">Ingestion Pipeline</h3>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#1c1c1f] bg-[#121215] px-4 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                </span>
                <span className="text-xs font-semibold text-white">Document Processing</span>
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
          className="overflow-hidden rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] shadow-card"
        >
          {/* Banner header */}
          <div className="relative overflow-hidden border-b border-[#1c1c1f] bg-[#121215] px-6 py-5">
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#1c1c1f] bg-[#0c0c0e]">
                  <Sparkles size={20} className="text-orange-500" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#1c1c1f] bg-[#09090b] text-[9px] font-black text-orange-500">02</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#71717a]">Stage 02</span>
                    <span className="h-px w-4 bg-[#1c1c1f]" />
                    <span className="text-[10px] text-[#71717a]">7 stages · Query → Embed → Retrieve → Rerank → LLM → Answer</span>
                  </div>
                  <h3 className="mt-0.5 text-base font-bold text-white">Query Pipeline</h3>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#1c1c1f] bg-[#121215] px-4 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                </span>
                <span className="text-xs font-semibold text-white">Retrieval & Generation</span>
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
