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
    color: '#3b82f6',
    activeClass: 'step-active-blue',
    iconBg: 'bg-blue-500/15',
    iconText: 'text-blue-400',
  },
  {
    id: 'parsing',
    label: 'Parse',
    sublabel: 'Text extract',
    tech: 'pdfplumber / docx',
    icon: FileSearch,
    color: '#a855f7',
    activeClass: 'step-active-purple',
    iconBg: 'bg-purple-500/15',
    iconText: 'text-purple-400',
  },
  {
    id: 'chunking',
    label: 'Chunk',
    sublabel: 'Segment text',
    tech: 'recursive split',
    icon: Scissors,
    color: '#f59e0b',
    activeClass: 'step-active-amber',
    iconBg: 'bg-amber-500/15',
    iconText: 'text-amber-400',
  },
  {
    id: 'embedding',
    label: 'Embed',
    sublabel: 'Vector encode',
    tech: 'nv-embedqa-e5-v5',
    icon: Cpu,
    color: '#8b5cf6',
    activeClass: 'step-active-violet',
    iconBg: 'bg-violet-500/15',
    iconText: 'text-violet-400',
  },
  {
    id: 'storing',
    label: 'Store',
    sublabel: 'Index vectors',
    tech: 'Pinecone upsert',
    icon: Database,
    color: '#10b981',
    activeClass: 'step-active-emerald',
    iconBg: 'bg-emerald-500/15',
    iconText: 'text-emerald-400',
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
    <div className="glass-card overflow-hidden rounded-2xl">
      {!hideHeader && <div className="flex items-center justify-between border-b border-border/50 px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-accent-blue/20 bg-gradient-to-br from-accent-blue/30 to-accent-purple/20">
            <Upload size={13} className="text-accent-blue" />
            {isActive && !isDone && !isError && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent-blue animate-pulse" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Ingestion Pipeline</h3>
            <p className="mt-0.5 max-w-[200px] truncate text-xs text-text-muted">
              {filename || 'Waiting for document…'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isActive && !isDone && !isError && (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-400">
              <Loader2 size={11} className="animate-spin" />
              Running
            </span>
          )}
          {isDone && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-400">
              <CheckCircle2 size={11} />
              Complete
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-xs text-red-400">
              <AlertCircle size={11} />
              Failed
            </span>
          )}
        </div>
      </div>}

      <div className="px-5 py-5">
        {/* ── Steps row ── */}
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const st = status(step.id, stage);
            const Icon = step.icon;
            const isStepActive = st === 'active';
            const isStepDone = st === 'done';

            return (
              <div key={step.id} className="flex flex-1 items-center">
                {/* Step column */}
                <div className="flex flex-1 flex-col items-center">
                  <motion.div
                    className={clsx(
                      'relative flex w-full cursor-default flex-col items-center gap-2 rounded-2xl border px-2 pb-3 pt-4 transition-all duration-500',
                      isStepActive && step.activeClass,
                      isStepDone && 'border-emerald-500/30 bg-emerald-500/5',
                      st === 'idle' && 'border-border/60 bg-white/[0.025]',
                      st === 'error' && 'border-red-500/30 bg-red-500/5',
                    )}
                    animate={isStepActive ? { y: [-1, 1, -1] } : {}}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {isStepActive && (
                      <>
                        <div className="pulse-ring absolute inset-0 rounded-2xl" style={{ border: `1px solid ${step.color}40` }} />
                        <div className="pulse-ring absolute inset-0 rounded-2xl" style={{ border: `1px solid ${step.color}25`, animationDelay: '0.5s' }} />
                      </>
                    )}

                    {/* Number badge */}
                    <span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1 text-[9px] font-black"
                      style={
                        isStepActive
                          ? { background: step.color, borderColor: 'transparent', color: '#fff' }
                          : { borderColor: '#2a2a50', color: '#4a5568', background: 'var(--bg-primary, #0d0d1a)' }
                      }
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    {/* Icon */}
                    <div
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300',
                        isStepActive ? step.iconBg : isStepDone ? 'bg-emerald-500/10' : 'bg-white/[0.04]',
                      )}
                    >
                      {isStepActive ? (
                        <Loader2 size={18} className={clsx(step.iconText, 'animate-spin')} />
                      ) : isStepDone ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : st === 'error' ? (
                        <AlertCircle size={18} className="text-red-400" />
                      ) : (
                        <Icon size={18} className="text-text-muted" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="text-center">
                      <p className={clsx('text-xs font-semibold leading-tight', isStepActive ? 'text-text-primary' : isStepDone ? 'text-emerald-400' : 'text-text-muted')}>
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-tight text-text-muted">{step.sublabel}</p>
                    </div>
                  </motion.div>

                  {/* Tech label */}
                  <p className="mt-2 w-full truncate px-1 text-center text-[10px] text-text-muted">{step.tech}</p>
                </div>

                {/* Connector (between steps only) */}
                {i < STEPS.length - 1 && (
                  <Connector fromStatus={st} toColor={STEPS[i + 1].color} />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-black/10 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Current step</p>
            <p className="mt-2 text-sm font-semibold capitalize text-text-primary">{stage}</p>
          </div>
          <div className="rounded-xl border border-border bg-black/10 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Chunks</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              {embedded_chunks} / {total_chunks || 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-black/10 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Progress</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">{progress.toFixed(1)}%</p>
          </div>
        </div>

        <AnimatePresence>
          {(stage === 'embedding' || stage === 'storing') && total_chunks > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/8 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-violet-300">Embedding chunks</span>
                  <span className="text-xs font-mono text-violet-400">
                    {embedded_chunks} <span className="text-text-muted">/</span> {total_chunks}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.1) 50%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s linear infinite',
                    }}
                  />
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #7c3aed, #a855f7, #8b5cf6)',
                      boxShadow: '0 0 12px rgba(139,92,246,0.6)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {Array.from({ length: Math.min(6, total_chunks) }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="h-3 w-1.5 rounded-full"
                        style={{ background: i < Math.ceil((embedded_chunks / total_chunks) * 6) ? '#8b5cf6' : '#1e1e3a' }}
                        animate={i === Math.ceil((embedded_chunks / total_chunks) * 6) - 1 ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.3 }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-mono font-bold text-violet-400">{progress.toFixed(1)}%</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3"
            >
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-emerald-400">Ingestion complete</p>
                <p className="text-xs text-text-muted">{total_chunks} chunks embedded and stored in Pinecone</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
