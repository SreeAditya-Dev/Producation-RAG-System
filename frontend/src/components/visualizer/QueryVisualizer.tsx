import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Cpu, Search, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { QueryState, QueryStage } from '../../types';

interface StepConfig {
  id: QueryStage;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  glowColor: string;
}

const STEPS: StepConfig[] = [
  { id: 'embedding', label: 'Embed', sublabel: 'Vectorize query', icon: Cpu, glowColor: '#a855f7' },
  { id: 'retrieving', label: 'Search', sublabel: 'Pinecone lookup', icon: Search, glowColor: '#06b6d4' },
  { id: 'generating', label: 'Generate', sublabel: 'LLM synthesis', icon: Sparkles, glowColor: '#7c3aed' },
  { id: 'complete', label: 'Answer', sublabel: 'Response ready', icon: CheckCircle2, glowColor: '#10b981' },
];

const STAGE_ORDER: QueryStage[] = ['idle', 'embedding', 'retrieving', 'generating', 'complete', 'error'];

function stageIdx(s: QueryStage) {
  return STAGE_ORDER.indexOf(s);
}

function stepStatus(stepId: QueryStage, current: QueryStage): 'idle' | 'active' | 'complete' | 'error' {
  if (current === 'error') return 'error';
  const si = stageIdx(stepId);
  const ci = stageIdx(current);
  if (si < ci) return 'complete';
  if (si === ci) return 'active';
  return 'idle';
}

interface Props {
  state: QueryState;
}

export function QueryVisualizer({ state }: Props) {
  const { stage, question, sources, streamingAnswer, processingTime } = state;

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-text-primary">Query Pipeline</h3>
          <p className="mt-0.5 max-w-xs truncate text-xs text-text-muted">
            {question ? `"${question.slice(0, 60)}${question.length > 60 ? '…' : ''}"` : 'No active query'}
          </p>
        </div>
        {stage === 'complete' && processingTime && <span className="font-mono text-xs text-accent-green">{processingTime.toFixed(2)}s</span>}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[420px] items-center gap-1">
          {STEPS.map((step, i) => {
            const status = stepStatus(step.id, stage);
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex min-w-0 flex-1 items-center">
                <motion.div
                  className={clsx(
                    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-500',
                    status === 'active' && 'border-accent-cyan bg-accent-cyan/10',
                    status === 'complete' && 'border-accent-green/60 bg-accent-green/10',
                    status === 'error' && 'border-accent-red/60 bg-accent-red/10',
                    status === 'idle' && 'border-border bg-bg-hover'
                  )}
                  animate={
                    status === 'active'
                      ? { boxShadow: [`0 0 0px ${step.glowColor}00`, `0 0 20px ${step.glowColor}60`, `0 0 0px ${step.glowColor}00`] }
                      : {}
                  }
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  {status === 'active' ? (
                    <Loader2 size={17} className="animate-spin text-accent-cyan" />
                  ) : status === 'complete' ? (
                    <CheckCircle2 size={17} className="text-accent-green" />
                  ) : status === 'error' ? (
                    <AlertCircle size={17} className="text-accent-red" />
                  ) : (
                    <Icon size={17} className="text-text-muted" />
                  )}
                </motion.div>

                {i < STEPS.length - 1 && (
                  <div className="relative mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                    {(status === 'active' || status === 'complete') && (
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-cyan to-accent-purple"
                        initial={{ width: '0%' }}
                        animate={{ width: status === 'complete' ? '100%' : '50%' }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[420px] items-start">
          {STEPS.map((step) => {
            const status = stepStatus(step.id, stage);
            return (
              <div key={step.id} className="flex-1 text-center">
                <p className={clsx('text-xs font-medium', status === 'active' ? 'text-accent-cyan' : status === 'complete' ? 'text-accent-green' : 'text-text-muted')}>
                  {step.label}
                </p>
                <p className="text-xs text-text-muted">{step.sublabel}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-black/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Status</p>
          <p className="mt-2 text-sm font-semibold capitalize text-text-primary">{stage}</p>
        </div>
        <div className="rounded-xl border border-border bg-black/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Sources</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">{sources.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-black/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Latency</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">{processingTime ? `${processingTime.toFixed(2)}s` : 'Pending'}</p>
        </div>
      </div>

      <AnimatePresence>
        {sources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <p className="text-xs font-medium text-text-muted">Retrieved Chunks</p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {sources.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-bg-hover px-3 py-2"
                >
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-accent-purple/20">
                    <span className="font-mono text-xs text-accent-purple">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-secondary">{s.original_name}</p>
                    <p className="truncate text-xs text-text-muted">{s.text?.slice(0, 80)}…</p>
                  </div>
                  <div className="flex-shrink-0 font-mono text-xs text-accent-cyan">{(s.score * 100).toFixed(0)}%</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {streamingAnswer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-accent-purple/20 bg-bg-hover p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
              <Sparkles size={11} className="text-accent-purple" />
              Generating…
            </p>
            <p className="line-clamp-4 text-xs leading-relaxed text-text-primary">
              {streamingAnswer}
              {stage === 'generating' && <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-accent-purple align-text-bottom" />}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
