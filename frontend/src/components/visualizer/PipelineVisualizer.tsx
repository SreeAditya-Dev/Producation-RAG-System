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
  color: string;
  activeClass: string;
  iconBg: string;
  iconText: string;
}

const STEPS: StepConfig[] = [
  {
    id: 'upload',
    label: 'Upload',
    sublabel: 'File intake',
    tech: 'drag + validate',
    icon: Upload,
    color: '#F4831F',
    activeClass: 'step-active',
    iconBg: 'bg-accent-primary/15',
    iconText: 'text-accent-primary',
  },
  {
    id: 'parsing',
    label: 'Parse',
    sublabel: 'Text extract',
    tech: 'pdfplumber / docx',
    icon: FileSearch,
    color: '#F4831F',
    activeClass: 'step-active',
    iconBg: 'bg-accent-primary/15',
    iconText: 'text-accent-primary',
  },
  {
    id: 'chunking',
    label: 'Chunk',
    sublabel: 'Segment text',
    tech: 'recursive split',
    icon: Scissors,
    color: '#F4831F',
    activeClass: 'step-active',
    iconBg: 'bg-accent-primary/15',
    iconText: 'text-accent-primary',
  },
  {
    id: 'embedding',
    label: 'Embed',
    sublabel: 'Vector encode',
    tech: 'nv-embedqa-e5-v5',
    icon: Cpu,
    color: '#F4831F',
    activeClass: 'step-active',
    iconBg: 'bg-accent-primary/15',
    iconText: 'text-accent-primary',
  },
  {
    id: 'storing',
    label: 'Store',
    sublabel: 'Index vectors',
    tech: 'Pinecone upsert',
    icon: Database,
    color: '#F4831F',
    activeClass: 'step-active',
    iconBg: 'bg-accent-primary/15',
    iconText: 'text-accent-primary',
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

function Connector({ fromStatus, toColor }: { fromStatus: 'idle' | 'active' | 'done' | 'error'; toColor: string }) {
  const isLit = fromStatus === 'done' || fromStatus === 'active';

  return (
    <div className="flex shrink-0 items-center" style={{ width: '40px' }}>
      <div className="relative flex flex-1 items-center">
        {/* base track */}
        <div className="h-[2px] w-full rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
        {/* lit fill */}
        {isLit && (
          <motion.div
            className="absolute inset-0 h-[2px] rounded-full"
            style={{ background: `linear-gradient(90deg, ${toColor}60, ${toColor}cc)` }}
            initial={{ scaleX: 0, transformOrigin: 'left' }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}
        {/* particles */}
        {fromStatus === 'active' && (
          <>
            <div className="particle" style={{ background: toColor, boxShadow: `0 0 6px ${toColor}` }} />
            <div className="particle particle-delayed-1" style={{ background: toColor, opacity: 0.7 }} />
            <div className="particle particle-delayed-2" style={{ background: toColor, opacity: 0.5 }} />
          </>
        )}
      </div>
      {/* chevron arrow */}
      <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="shrink-0">
        <path
          d="M1.5 1.5L6 6l-4.5 4.5"
          stroke={isLit ? toColor : 'rgba(255,255,255,0.15)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
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
    <div className="bg-[#0c0c0e] overflow-hidden rounded-lg border border-zinc-800">
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Pipeline telemetry</span>
          </div>
          <div className="flex items-center gap-2">
            {isActive && !isDone && !isError && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                <Loader2 size={10} className="animate-spin text-zinc-400" />
                Ingesting
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                Ready
              </span>
            )}
            {isError && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-2 py-0.5 text-[10px] font-mono text-red-400">
                Error
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-4 space-y-5">
        {/* Active filename details */}
        {filename && (
          <div className="border border-zinc-800 bg-zinc-900/10 rounded-lg p-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Processing Payload</p>
              <p className="text-xs text-zinc-200 truncate mt-1">{filename}</p>
            </div>
            {total_chunks > 0 && (
              <div className="text-right pl-4">
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Segment Chunks</p>
                <p className="text-xs text-zinc-200 font-mono mt-1">{total_chunks}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Vertical Timeline Steps ── */}
        <div className="relative pl-2.5">
          {/* Vertical track line */}
          <div className="absolute left-[21px] top-2.5 bottom-2.5 w-[1px] bg-zinc-800" />

          <div className="space-y-5">
            {STEPS.map((step, i) => {
              const st = status(step.id, stage);
              const isStepActive = st === 'active';
              const isStepDone = st === 'done';
              const isStepError = st === 'error';

              return (
                <div key={step.id} className="relative flex items-start gap-4 group">
                  {/* Node Circle */}
                  <div
                    className={clsx(
                      'relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[#0c0c0e] border transition-all duration-300',
                      isStepActive
                        ? 'border-zinc-200 text-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.05)]'
                        : isStepDone
                        ? 'border-zinc-700 text-zinc-400'
                        : isStepError
                        ? 'border-red-500/50 text-red-400 bg-red-500/5'
                        : 'border-zinc-900 text-zinc-600 bg-zinc-950'
                    )}
                  >
                    {isStepDone ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    ) : isStepActive ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-300 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-200" />
                      </span>
                    ) : isStepError ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-zinc-800" />
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between">
                      <p
                        className={clsx(
                          'text-xs font-semibold',
                          isStepActive ? 'text-zinc-200' : isStepDone ? 'text-zinc-400' : 'text-zinc-600'
                        )}
                      >
                        {step.label}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-600">{step.tech}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{step.sublabel}</p>
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
              <div className="border border-zinc-800 bg-zinc-900/10 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>Embedding Vector Sets</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-zinc-900 border border-zinc-800 rounded-full h-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-zinc-300"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                  />
                </div>
                <p className="text-zinc-500 text-[10px] font-mono text-right">
                  {embedded_chunks} / {total_chunks} chunks stored
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Status Metrics ── */}
        <div className="grid gap-2 grid-cols-3 pt-2 border-t border-zinc-800/60">
          <div className="text-left">
            <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono">Stage</p>
            <p className="mt-1 text-xs font-semibold text-zinc-200 capitalize font-mono truncate">{stage}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono">Chunks</p>
            <p className="mt-1 text-xs font-semibold text-zinc-200 font-mono">
              {embedded_chunks}/{total_chunks}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono">Progress</p>
            <p className="mt-1 text-xs font-semibold text-zinc-200 font-mono">{progress.toFixed(0)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
