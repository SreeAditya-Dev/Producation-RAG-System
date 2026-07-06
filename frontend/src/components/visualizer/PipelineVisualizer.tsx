import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Upload,
  FileSearch,
  Scissors,
  Cpu,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { PipelineState, PipelineStage } from '../../types';

interface StepConfig {
  id: PipelineStage;
  label: string;
  sublabel: string;
  tech: string;
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  {
    id: 'upload',
    label: 'Payload Intake',
    sublabel: 'Ingesting source document',
    tech: 'Multipart Form',
    icon: Upload,
  },
  {
    id: 'parsing',
    label: 'Document Parsing',
    sublabel: 'Extracting semantic text layers',
    tech: 'pdfplumber / docx',
    icon: FileSearch,
  },
  {
    id: 'chunking',
    label: 'Semantic Chunking',
    sublabel: 'Splitting text into overlapping nodes',
    tech: 'Recursive Split',
    icon: Scissors,
  },
  {
    id: 'embedding',
    label: 'Vector Embedding',
    sublabel: 'Calculating float32 dense vectors',
    tech: 'NV-EmbedQA-E5-v5',
    icon: Cpu,
  },
  {
    id: 'storing',
    label: 'Vector Store Ingestion',
    sublabel: 'Upserting index vectors',
    tech: 'Pinecone Upsert',
    icon: Database,
  },
];

const ORDER: PipelineStage[] = ['idle', 'upload', 'parsing', 'chunking', 'embedding', 'storing', 'complete', 'error'];

function idx(s: PipelineStage) {
  return ORDER.indexOf(s);
}

function status(stepId: PipelineStage, current: PipelineStage): 'idle' | 'active' | 'done' | 'error' {
  if (current === 'error') return 'error';
  if (current === 'complete') return 'done';
  const si = idx(stepId);
  const ci = idx(current);
  if (si < ci) return 'done';
  if (si === ci) return 'active';
  return 'idle';
}

interface Props {
  state: PipelineState;
  hideHeader?: boolean;
}

export function PipelineVisualizer({ state, hideHeader = false }: Props) {
  const { stage, filename, total_chunks, embedded_chunks, progress } = state;
  const isActive = stage !== 'idle';
  const isDone = stage === 'complete';
  const isError = stage === 'error';

  return (
    <div className="bg-[#000000] overflow-hidden rounded-lg border border-zinc-800 font-sans select-none">
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-[#09090b] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-300 font-semibold">Ingestion Ingress</span>
          </div>
          <div className="flex items-center gap-2">
            {isActive && !isDone && !isError && (
              <span className="inline-flex items-center gap-1.5 rounded border border-[#F4831F]/30 bg-[#F4831F]/5 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#F4831F]">
                <Loader2 size={10} className="animate-spin text-[#F4831F]" />
                Ingesting
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400">
                Ready
              </span>
            )}
            {isError && (
              <span className="inline-flex items-center gap-1.5 rounded border border-red-950 bg-red-950/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-red-405">
                Error
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-5 space-y-5">
        {/* Active filename details */}
        {filename && (
          <div className="border border-zinc-800 bg-[#09090b]/80 rounded-md p-3 flex items-center justify-between font-mono text-[9px] text-zinc-450">
            <div className="min-w-0 flex-1">
              <span className="text-zinc-600">Payload:</span>
              <p className="text-zinc-200 truncate mt-0.5 text-xs font-sans font-semibold">{filename}</p>
            </div>
            {total_chunks > 0 && (
              <div className="text-right pl-4">
                <span className="text-zinc-655">Chunks:</span>
                <p className="text-[#F4831F] font-mono mt-0.5 text-xs font-semibold">{total_chunks}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Vertical Timeline Steps ── */}
        <div className="relative pl-1">
          {/* Vertical track line */}
          <div className="absolute left-[13px] top-2 bottom-2 w-[1px] bg-zinc-850" />

          <div className="space-y-6">
            {STEPS.map((step, i) => {
              const st = status(step.id, stage);
              const isStepActive = st === 'active';
              const isStepDone = st === 'done';
              const isStepError = st === 'error';

              return (
                <div key={step.id} className="relative flex items-start gap-4">
                  {/* Node Circle Indicator */}
                  <div
                    className={clsx(
                      'relative z-10 flex items-center justify-center w-7 h-7 rounded-lg bg-black border transition-colors duration-200',
                      isStepActive
                        ? 'border-[#F4831F] text-[#F4831F] bg-[#F4831F]/5 shadow-[0_0_8px_rgba(244,131,31,0.06)]'
                        : isStepDone
                        ? 'border-zinc-700 text-zinc-400 bg-zinc-900/30'
                        : isStepError
                        ? 'border-red-500 text-red-500 bg-red-950/10'
                        : 'border-zinc-800 text-zinc-600 bg-zinc-950'
                    )}
                  >
                    {isStepActive ? (
                      <Loader2 size={11} className="animate-spin text-[#F4831F]" />
                    ) : isStepDone ? (
                      <CheckCircle2 size={11} className="text-zinc-400" />
                    ) : isStepError ? (
                      <AlertCircle size={11} />
                    ) : (
                      <step.icon size={11} />
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between">
                      <p
                        className={clsx(
                          'text-xs font-semibold font-mono uppercase tracking-wider',
                          isStepActive ? 'text-[#F4831F]' : isStepDone ? 'text-zinc-400' : 'text-zinc-600'
                        )}
                      >
                        {step.label}
                      </p>
                      <span className="text-[9px] font-mono text-zinc-600">{step.tech}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5 font-sans leading-relaxed">{step.sublabel}</p>

                    {/* Inline metadata under active chunking/storing steps */}
                    {isStepActive && step.id === 'chunking' && (
                      <div className="mt-2 text-[9px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-900 p-2 rounded">
                        <span className="text-zinc-600">Strategy:</span> Recursive Character Split (size: 500, overlap: 50)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Progress bar section ── */}
        <AnimatePresence>
          {(stage === 'embedding' || stage === 'storing') && total_chunks > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden pt-2"
            >
              <div className="border border-zinc-800 bg-[#09090b]/80 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                  <span>Upserting Ingestion Vectors</span>
                  <span className="font-semibold text-zinc-200">{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-zinc-900 border border-zinc-850 rounded h-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-[#F4831F]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                  />
                </div>
                <p className="text-zinc-500 text-[9px] font-mono text-right uppercase tracking-wider">
                  <span className="text-[#F4831F] font-bold">{embedded_chunks}</span> / {total_chunks} blocks indexed
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Status Metrics ── */}
        <div className="grid gap-2 grid-cols-3 pt-3.5 border-t border-zinc-850 bg-black">
          <div className="text-left">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-mono font-semibold">Active State</p>
            <p className="mt-1 text-xs font-semibold text-[#F4831F] capitalize font-mono truncate">{stage}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-mono font-semibold">Vectors Indexed</p>
            <p className="mt-1 text-xs font-semibold text-zinc-350 font-mono">
              {embedded_chunks}/{total_chunks}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-mono font-semibold">Upsert Rate</p>
            <p className="mt-1 text-xs font-semibold text-zinc-350 font-mono">{progress.toFixed(0)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
