import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Upload, FileSearch, Scissors, Cpu, Database,
  CheckCircle2, AlertCircle, ArrowRight, Loader2,
} from 'lucide-react';
import type { PipelineState, PipelineStage } from '../../types';

interface StepConfig {
  id: PipelineStage;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  glowColor: string;
}

const STEPS: StepConfig[] = [
  { id: 'upload', label: 'Upload', sublabel: 'Receive file', icon: Upload, color: 'text-accent-cyan', glowColor: '#06b6d4' },
  { id: 'parsing', label: 'Parse', sublabel: 'Extract text', icon: FileSearch, color: 'text-accent-purple-light', glowColor: '#a855f7' },
  { id: 'chunking', label: 'Chunk', sublabel: 'Split text', icon: Scissors, color: 'text-accent-orange', glowColor: '#f59e0b' },
  { id: 'embedding', label: 'Embed', sublabel: 'NVIDIA NIM', icon: Cpu, color: 'text-accent-purple', glowColor: '#7c3aed' },
  { id: 'storing', label: 'Store', sublabel: 'Pinecone DB', icon: Database, color: 'text-accent-green', glowColor: '#10b981' },
];

const STAGE_ORDER: PipelineStage[] = ['idle', 'upload', 'parsing', 'chunking', 'embedding', 'storing', 'complete', 'error'];

function getStageIndex(stage: PipelineStage) {
  return STAGE_ORDER.indexOf(stage);
}

function getStepStatus(stepId: PipelineStage, currentStage: PipelineStage): 'idle' | 'active' | 'complete' | 'error' {
  if (currentStage === 'error') {
    const stepIdx = getStageIndex(stepId);
    const currentIdx = getStageIndex(currentStage);
    if (stepIdx < currentIdx) return 'complete';
    if (stepIdx === currentIdx) return 'error';
    return 'idle';
  }
  if (currentStage === 'complete') return 'complete';
  const stepIdx = getStageIndex(stepId);
  const currentIdx = getStageIndex(currentStage);
  if (stepIdx < currentIdx) return 'complete';
  if (stepIdx === currentIdx) return 'active';
  return 'idle';
}

interface Props {
  state: PipelineState;
}

export function PipelineVisualizer({ state }: Props) {
  const { stage, filename, total_chunks, embedded_chunks, progress } = state;
  const isActive = stage !== 'idle';

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text-primary font-semibold">Ingestion Pipeline</h3>
          <p className="text-text-muted text-xs mt-0.5">
            {filename ? `Processing: ${filename}` : 'Waiting for documents…'}
          </p>
        </div>
        {isActive && stage !== 'complete' && stage !== 'error' && (
          <div className="flex items-center gap-2 text-xs text-accent-orange">
            <Loader2 size={13} className="animate-spin" />
            <span>Running</span>
          </div>
        )}
        {stage === 'complete' && (
          <div className="flex items-center gap-2 text-xs text-accent-green">
            <CheckCircle2 size={13} />
            <span>Complete</span>
          </div>
        )}
        {stage === 'error' && (
          <div className="flex items-center gap-2 text-xs text-accent-red">
            <AlertCircle size={13} />
            <span>Failed</span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const status = getStepStatus(step.id, stage);
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              {/* Node */}
              <motion.div
                className={clsx(
                  'relative flex-shrink-0 w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-500',
                  status === 'active' && 'border-accent-purple shadow-lg',
                  status === 'complete' && 'border-accent-green/60 bg-accent-green/10',
                  status === 'error' && 'border-accent-red/60 bg-accent-red/10',
                  status === 'idle' && 'border-border bg-bg-hover'
                )}
                animate={
                  status === 'active'
                    ? { boxShadow: [`0 0 0px ${step.glowColor}00`, `0 0 20px ${step.glowColor}60`, `0 0 0px ${step.glowColor}00`] }
                    : {}
                }
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {status === 'active' ? (
                  <Loader2 size={18} className={clsx(step.color, 'animate-spin')} />
                ) : status === 'complete' ? (
                  <CheckCircle2 size={18} className="text-accent-green" />
                ) : status === 'error' ? (
                  <AlertCircle size={18} className="text-accent-red" />
                ) : (
                  <Icon size={18} className={clsx(status === 'idle' ? 'text-text-muted' : step.color)} />
                )}
              </motion.div>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-1 h-0.5 relative overflow-hidden rounded-full bg-border">
                  {(status === 'active' || status === 'complete') && (
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: status === 'complete' ? '100%' : '60%' }}
                      transition={{ duration: 0.6 }}
                    />
                  )}
                  {status === 'active' && (
                    <motion.div
                      className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ left: ['-30%', '130%'] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex items-start">
        {STEPS.map((step) => {
          const status = getStepStatus(step.id, stage);
          return (
            <div key={step.id} className="flex-1 text-center">
              <p className={clsx(
                'text-xs font-medium',
                status === 'active' ? 'text-text-primary' : status === 'complete' ? 'text-accent-green' : 'text-text-muted'
              )}>
                {step.label}
              </p>
              <p className="text-xs text-text-muted mt-0.5">{step.sublabel}</p>
            </div>
          );
        })}
      </div>

      {/* Progress bar for embedding */}
      <AnimatePresence>
        {(stage === 'embedding' || stage === 'storing') && total_chunks > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Embedding chunks</span>
              <span className="font-mono text-accent-purple">
                {embedded_chunks} / {total_chunks}
              </span>
            </div>
            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-text-muted text-right font-mono">{progress.toFixed(1)}%</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
