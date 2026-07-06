import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Signal, Upload, Sparkles, Server, HardDrive, Terminal } from 'lucide-react';
import { clsx } from 'clsx';
import { usePipelineCtx } from '../components/layout/Layout';
import { PipelineVisualizer } from '../components/visualizer/PipelineVisualizer';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';
import { EventLog } from '../components/visualizer/EventLog';

const ARCH_STEPS = [
  { label: 'Source Documents', sub: 'PDF, DOCX, TXT, MD', tech: 'Client Upload Ingress', icon: Upload },
  { label: 'FastAPI Engine', sub: 'Python Framework', tech: 'WebSocket Telemetry & Router', icon: Server },
  { label: 'NVIDIA NIM API', sub: 'NV-EmbedQA-E5 & Llama-3.3', tech: 'High-Performance Inference', icon: Sparkles },
  { label: 'Pinecone Serverless', sub: '1024-dim Vector Database', tech: 'ANN Similarity Indexing', icon: HardDrive },
  { label: 'RAG Studio UI', sub: 'React & Telemetry', tech: 'State Observability Surface', icon: Terminal },
];

export function Visualizer() {
  const { pipeline, queryState, eventLog, clearLog, connected } = usePipelineCtx();

  useEffect(() => {
    const handler = () => clearLog();
    window.addEventListener('rag:refresh', handler);
    return () => window.removeEventListener('rag:refresh', handler);
  }, [clearLog]);

  return (
    <div className="px-6 py-6 mx-auto w-full h-full max-w-[1600px] font-sans text-zinc-300">
      {/* Page Header (Clean, typography-focused, non-boxed) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-sm font-mono tracking-widest uppercase font-bold text-white flex items-center gap-2">
            <Signal size={13} className="text-[#F4831F]" />
            System Observability
          </h2>
          <p className="mt-1 text-xs text-zinc-550 font-mono">
            Follow Ingestion and Query Execution pipelines via Live WebSocket telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div
            className={clsx(
              'flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider',
              connected ? 'border-[#F4831F]/20 bg-[#F4831F]/5 text-emerald-500 font-bold' : 'border-red-950 bg-red-950/10 text-red-500 font-bold'
            )}
          >
            <Radio size={11} className={connected ? 'animate-pulse text-emerald-500' : 'text-red-500'} />
            {connected ? 'Connection Live' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Main Asymmetric Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Pipelines (7/12 width) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Stage 01: Ingestion Pipeline */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden rounded-lg border border-zinc-800 bg-[#000000] shadow-md"
          >
            <div className="relative border-b border-zinc-800 bg-[#09090b] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#F4831F]/5 border border-[#F4831F]/25 text-[9px] font-mono font-bold text-[#F4831F]">
                    01
                  </div>
                  <div>
                    <h3 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">Ingestion Pipeline</h3>
                    <p className="text-[9px] text-zinc-550 font-mono mt-0.5 uppercase tracking-wide">
                      Upload &rarr; Parse &rarr; Chunk &rarr; Embed &rarr; Store
                    </p>
                  </div>
                </div>
                <span className="rounded border border-[#F4831F]/30 bg-[#F4831F]/5 px-2 py-0.5 font-mono text-[9px] text-[#F4831F] uppercase tracking-wider font-semibold">
                  Ingress Stage
                </span>
              </div>
            </div>
            <PipelineVisualizer state={pipeline} hideHeader />
          </motion.section>

          {/* Stage 02: Query Pipeline */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="overflow-hidden rounded-lg border border-zinc-800 bg-[#000000] shadow-md"
          >
            <div className="relative border-b border-zinc-800 bg-[#09090b] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#F4831F]/5 border border-[#F4831F]/25 text-[9px] font-mono font-bold text-[#F4831F]">
                    02
                  </div>
                  <div>
                    <h3 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">Query Pipeline</h3>
                    <p className="text-[9px] text-zinc-550 font-mono mt-0.5 uppercase tracking-wide">
                      Query &rarr; Embed &rarr; Retrieve &rarr; Rerank &rarr; LLM &rarr; Answer
                    </p>
                  </div>
                </div>
                <span className="rounded border border-[#F4831F]/30 bg-[#F4831F]/5 px-2 py-0.5 font-mono text-[9px] text-[#F4831F] uppercase tracking-wider font-semibold">
                  Retrieval Stage
                </span>
              </div>
            </div>
            <QueryVisualizer state={queryState} hideHeader />
          </motion.section>
        </div>

        {/* Right Column: Architecture & Logs (5/12 width) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col h-full">
          {/* Architecture Map Card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-zinc-800 bg-[#000000] p-5"
          >
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-[#F4831F] font-semibold">RAG System Stack</p>
                <h3 className="text-xs font-semibold text-zinc-300 font-mono uppercase tracking-wider mt-0.5">Architecture Flow</h3>
              </div>
            </div>
            
            {/* Vertical Flow Architecture */}
            <div className="mt-5 relative pl-1.5">
              <div className="absolute left-[13px] top-2.5 bottom-2.5 w-[1px] bg-zinc-900" />
              
              <div className="space-y-4">
                {ARCH_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={i} className="relative flex items-start gap-4">
                      {/* Node Circle */}
                      <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded bg-zinc-950 border border-zinc-900 text-[#F4831F] bg-[#F4831F]/5">
                        <Icon size={12} />
                      </div>
                      {/* Details */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-300">
                          {step.label}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5 leading-none">
                          {step.sub} &middot; <span className="text-[9px] text-zinc-600 font-light">{step.tech}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Event Log Console Card */}
          <div className="flex-1 min-h-[360px] rounded-lg border border-zinc-800 bg-[#000000] overflow-hidden flex flex-col">
            <EventLog entries={eventLog} onClear={clearLog} connected={connected} />
          </div>
        </div>
      </div>
    </div>
  );
}
export default Visualizer;
