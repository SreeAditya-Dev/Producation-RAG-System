import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  MessageSquare, Cpu, Search, BookOpen, Sparkles,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
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

function stageIdx(s: QueryStage) { return STAGE_ORDER.indexOf(s); }

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
  const isActive = stage !== 'idle';

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text-primary font-semibold">Query Pipeline</h3>
          <p className="text-text-muted text-xs mt-0.5 truncate max-w-xs">
            {question ? `"${question.slice(0, 60)}${question.length > 60 ? '…' : ''}"` : 'No active query'}
          </p>
        </div>
        {stage === 'complete' && processingTime && (
          <span className="text-xs text-accent-green font-mono">{processingTime.toFixed(2)}s</span>
        )}
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const status = stepStatus(step.id, stage);
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <motion.div
                className={clsx(
                  'flex-shrink-0 w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all duration-500',
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
                  <Loader2 size={17} className="text-accent-cyan animate-spin" />
                ) : status === 'complete' ? (
                  <CheckCircle2 size={17} className="text-accent-green" />
                ) : status === 'error' ? (
                  <AlertCircle size={17} className="text-accent-red" />
                ) : (
                  <Icon size={17} className="text-text-muted" />
                )}
              </motion.div>

              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-1 h-0.5 relative overflow-hidden rounded-full bg-border">
                  {(status === 'active' || status === 'complete') && (
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full"
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

      {/* Step labels */}
      <div className="flex items-start">
        {STEPS.map((step) => {
          const status = stepStatus(step.id, stage);
          return (
            <div key={step.id} className="flex-1 text-center">
              <p className={clsx(
                'text-xs font-medium',
                status === 'active' ? 'text-accent-cyan' : status === 'complete' ? 'text-accent-green' : 'text-text-muted'
              )}>
                {step.label}
              </p>
              <p className="text-xs text-text-muted">{step.sublabel}</p>
            </div>
          );
        })}
      </div>

      {/* Retrieved chunks */}
      <AnimatePresence>
        {sources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <p className="text-xs text-text-muted font-medium">Retrieved Chunks</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {sources.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 px-3 py-2 bg-bg-hover rounded-lg border border-border"
                >
                  <div className="w-5 h-5 rounded bg-accent-purple/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-accent-purple font-mono">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary font-medium truncate">{s.original_name}</p>
                    <p className="text-xs text-text-muted truncate">{s.text?.slice(0, 80)}…</p>
                  </div>
                  <div className="text-xs font-mono text-accent-cyan flex-shrink-0">
                    {(s.score * 100).toFixed(0)}%
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streaming answer preview */}
      <AnimatePresence>
        {streamingAnswer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-bg-hover rounded-xl border border-accent-purple/20"
          >
            <p className="text-xs text-text-muted mb-1.5 font-medium flex items-center gap-1.5">
              <Sparkles size={11} className="text-accent-purple" />
              Generating…
            </p>
            <p className="text-xs text-text-primary leading-relaxed line-clamp-4">
              {streamingAnswer}
              {stage === 'generating' && (
                <span className="inline-block w-0.5 h-3 bg-accent-purple animate-pulse ml-0.5 align-text-bottom" />
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
