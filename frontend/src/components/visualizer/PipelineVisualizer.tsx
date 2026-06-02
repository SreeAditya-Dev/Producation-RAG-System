import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Upload, FileSearch, Scissors, Cpu, Database,
  CheckCircle2, AlertCircle, Loader2, ArrowRight,
} from 'lucide-react';
import type { PipelineState, PipelineStage } from '../../types';

interface StepConfig {
  id: PipelineStage;
  label: string;
  sublabel: string;
  tech: string;
  icon: React.ElementType;
  color: string;
  glow: string;
  activeClass: string;
  iconBg: string;
  iconText: string;
  particleColor: string;
}

const STEPS: StepConfig[] = [
  {
    id: 'upload', label: 'Upload', sublabel: 'S3 Storage', tech: 'Supabase',
    icon: Upload, color: '#06b6d4', glow: 'rgba(6,182,212,0.5)',
    activeClass: 'step-active-cyan', iconBg: 'bg-cyan-500/15', iconText: 'text-cyan-400',
    particleColor: '#06b6d4',
  },
  {
    id: 'parsing', label: 'Parse', sublabel: 'Text extract', tech: 'pdfplumber / docx',
    icon: FileSearch, color: '#a855f7', glow: 'rgba(168,85,247,0.5)',
    activeClass: 'step-active-purple', iconBg: 'bg-purple-500/15', iconText: 'text-purple-400',
    particleColor: '#a855f7',
  },
  {
    id: 'chunking', label: 'Chunk', sublabel: 'Recursive split', tech: 'chunk=512 / overlap=50',
    icon: Scissors, color: '#f59e0b', glow: 'rgba(245,158,11,0.5)',
    activeClass: 'step-active-amber', iconBg: 'bg-amber-500/15', iconText: 'text-amber-400',
    particleColor: '#f59e0b',
  },
  {
    id: 'embedding', label: 'Embed', sublabel: 'Vector encode', tech: 'nv-embedqa-e5-v5 · 1024d',
    icon: Cpu, color: '#8b5cf6', glow: 'rgba(139,92,246,0.5)',
    activeClass: 'step-active-violet', iconBg: 'bg-violet-500/15', iconText: 'text-violet-400',
    particleColor: '#8b5cf6',
  },
  {
    id: 'storing', label: 'Store', sublabel: 'Pinecone upsert', tech: 'cosine · aws us-east-1',
    icon: Database, color: '#10b981', glow: 'rgba(16,185,129,0.5)',
    activeClass: 'step-active-emerald', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-400',
    particleColor: '#10b981',
  },
];

const ORDER: PipelineStage[] = ['idle', 'upload', 'parsing', 'chunking', 'embedding', 'storing', 'complete', 'error'];

function idx(s: PipelineStage) { return ORDER.indexOf(s); }

function status(stepId: PipelineStage, current: PipelineStage): 'idle' | 'active' | 'done' | 'error' {
  if (current === 'error') return idx(stepId) < idx(current) ? 'done' : 'idle';
  if (current === 'complete') return 'done';
  const si = idx(stepId), ci = idx(current);
  if (si < ci) return 'done';
  if (si === ci) return 'active';
  return 'idle';
}

function Connector({ fromStatus, toColor }: { fromStatus: 'idle' | 'active' | 'done' | 'error'; toColor: string }) {
  const isLit = fromStatus === 'done' || fromStatus === 'active';
  return (
    <div className="relative flex items-center justify-center w-8 shrink-0 mt-6">
      {/* Base line */}
      <div className="w-full h-0.5 bg-border rounded-full" />
      {/* Filled line */}
      {isLit && (
        <motion.div
          className="absolute left-0 top-0 h-0.5 rounded-full"
          style={{ background: `linear-gradient(90deg, ${toColor}80, ${toColor})` }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
      {/* Traveling particle */}
      {fromStatus === 'active' && (
        <>
          <div className="particle" style={{ background: toColor, boxShadow: `0 0 6px ${toColor}` }} />
          <div className="particle particle-delayed-1" style={{ background: toColor, boxShadow: `0 0 6px ${toColor}`, opacity: 0.7 }} />
          <div className="particle particle-delayed-2" style={{ background: toColor, boxShadow: `0 0 6px ${toColor}`, opacity: 0.5 }} />
        </>
      )}
    </div>
  );
}

interface Props { state: PipelineState }

export function PipelineVisualizer({ state }: Props) {
  const { stage, filename, total_chunks, embedded_chunks, progress } = state;
  const isActive = stage !== 'idle';
  const isDone = stage === 'complete';
  const isError = stage === 'error';

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-accent-cyan/30 to-accent-purple/20 flex items-center justify-center border border-accent-cyan/20">
            <Upload size={13} className="text-accent-cyan" />
            {isActive && !isDone && !isError && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-text-primary font-semibold text-sm">Ingestion Pipeline</h3>
            <p className="text-text-muted text-xs mt-0.5 truncate max-w-[200px]">
              {filename ? filename : 'Waiting for document…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isActive && !isDone && !isError && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
              <Loader2 size={11} className="animate-spin" />
              Running
            </span>
          )}
          {isDone && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={11} />
              Complete
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2.5 py-1 rounded-full">
              <AlertCircle size={11} />
              Failed
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 py-5">
        {/* Step nodes row */}
        <div className="flex items-start">
          {STEPS.map((step, i) => {
            const st = status(step.id, stage);
            const Icon = step.icon;
            const isStepActive = st === 'active';
            const isStepDone = st === 'done';

            return (
              <div key={step.id} className="flex items-center">
                {/* Step card */}
                <motion.div
                  className={clsx(
                    'relative flex flex-col items-center gap-2 rounded-xl p-3 border transition-all duration-500 cursor-default',
                    'w-[82px] sm:w-[90px]',
                    isStepActive && step.activeClass,
                    isStepDone && 'border-emerald-500/30 bg-emerald-500/5',
                    st === 'idle' && 'border-border bg-bg-hover/50',
                    st === 'error' && 'border-red-500/30 bg-red-500/5',
                  )}
                  animate={isStepActive ? {
                    y: [-1, 1, -1],
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {/* Pulse ring when active */}
                  {isStepActive && (
                    <>
                      <div
                        className="absolute inset-0 rounded-xl pulse-ring"
                        style={{ border: `1px solid ${step.color}40` }}
                      />
                      <div
                        className="absolute inset-0 rounded-xl pulse-ring"
                        style={{ border: `1px solid ${step.color}30`, animationDelay: '0.5s' }}
                      />
                    </>
                  )}

                  {/* Step number */}
                  <div className="absolute -top-2 -left-2">
                    <span
                      className={clsx(
                        'flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold border',
                        isStepActive && 'text-white border-transparent'
                      )}
                      style={isStepActive ? { background: step.color } : { borderColor: '#2a2a50', color: '#4a5568' }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Icon */}
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300',
                      isStepActive ? step.iconBg : isStepDone ? 'bg-emerald-500/10' : 'bg-white/4',
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
                    <p className={clsx(
                      'text-xs font-semibold leading-tight',
                      isStepActive ? 'text-text-primary' : isStepDone ? 'text-emerald-400' : 'text-text-muted'
                    )}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-text-muted leading-tight mt-0.5 hidden sm:block">
                      {step.sublabel}
                    </p>
                  </div>
                </motion.div>

                {/* Connector */}
                {i < STEPS.length - 1 && (
                  <Connector
                    fromStatus={status(step.id, stage)}
                    toColor={STEPS[i + 1].color}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Tech labels row */}
        <div className="flex mt-3">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className="w-[82px] sm:w-[90px] text-center">
                <p className="text-[10px] text-text-muted truncate px-1">{step.tech}</p>
              </div>
              {i < STEPS.length - 1 && <div className="w-8" />}
            </div>
          ))}
        </div>

        {/* Embedding progress */}
        <AnimatePresence>
          {(stage === 'embedding' || stage === 'storing') && total_chunks > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-violet-300 font-medium">Embedding chunks</span>
                  <span className="text-xs font-mono text-violet-400">
                    {embedded_chunks} <span className="text-text-muted">/</span> {total_chunks}
                  </span>
                </div>
                <div className="relative h-2 bg-black/40 rounded-full overflow-hidden">
                  {/* Track shimmer */}
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
                        className="w-1.5 h-3 rounded-full"
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

        {/* Complete banner */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-500/8 border border-emerald-500/25 rounded-xl"
            >
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-emerald-400 text-xs font-semibold">Ingestion complete</p>
                <p className="text-text-muted text-xs">{total_chunks} chunks embedded and stored in Pinecone</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
