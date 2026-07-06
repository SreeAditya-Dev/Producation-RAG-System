import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  MessageSquare,
  Cpu,
  Database,
  Layers,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Hash,
} from 'lucide-react';
import type { QueryState, QueryStage } from '../../types';

interface StageNode {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  rgb: string;
  glowClass: string;
}

const STAGES: StageNode[] = [
  {
    id: 'query',
    label: 'Query',
    sublabel: 'User Input',
    icon: MessageSquare,
    color: '#e2e8f0',
    rgb: '226,232,240',
    glowClass: '',
  },
  {
    id: 'embed',
    label: 'Embed',
    sublabel: 'NV-EmbedQA',
    icon: Cpu,
    color: '#F4831F',
    rgb: '244,131,31',
    glowClass: 'node-glow',
  },
  {
    id: 'pinecone',
    label: 'Pinecone',
    sublabel: 'ANN Search',
    icon: Database,
    color: '#F4831F',
    rgb: '244,131,31',
    glowClass: 'node-glow',
  },
  {
    id: 'retrieve',
    label: 'Retrieve',
    sublabel: 'Top-K Chunks',
    icon: Layers,
    color: '#F4831F',
    rgb: '244,131,31',
    glowClass: 'node-glow',
  },
  {
    id: 'rerank',
    label: 'Rerank',
    sublabel: 'NIM Reranker',
    icon: SlidersHorizontal,
    color: '#F4831F',
    rgb: '244,131,31',
    glowClass: 'node-glow',
  },
  {
    id: 'llm',
    label: 'LLM',
    sublabel: 'Llama-3.3-70B',
    icon: Sparkles,
    color: '#F4831F',
    rgb: '244,131,31',
    glowClass: 'node-glow',
  },
  {
    id: 'answer',
    label: 'Answer',
    sublabel: 'Response Ready',
    icon: CheckCircle2,
    color: '#F4831F',
    rgb: '244,131,31',
    glowClass: 'node-glow',
  },
];

type NodeStatus = 'idle' | 'active' | 'complete' | 'error';

function getNodeStatus(nodeId: string, current: QueryStage): NodeStatus {
  if (current === 'error') return 'error';
  const order: QueryStage[] = ['idle', 'embedding', 'retrieving', 'reranking', 'generating', 'complete'];
  const cp = order.indexOf(current);

  switch (nodeId) {
    case 'query':    return cp >= 1 ? 'active' : 'idle';
    case 'embed':    return cp === 1 ? 'active' : cp > 1 ? 'complete' : 'idle';
    case 'pinecone':   return cp === 2 ? 'active' : cp > 2 ? 'complete' : 'idle';
    case 'retrieve': return cp === 2 ? 'active' : cp > 2 ? 'complete' : 'idle';
    case 'rerank':   return cp === 3 ? 'active' : cp > 3 ? 'complete' : 'idle';
    case 'llm':      return cp === 4 ? 'active' : cp > 4 ? 'complete' : 'idle';
    case 'answer':   return cp >= 5 ? 'complete' : 'idle';
    default:         return 'idle';
  }
}

function getConnectorStatus(fromNodeId: string, current: QueryStage): NodeStatus {
  return getNodeStatus(fromNodeId, current);
}

interface ConnectorProps {
  status: NodeStatus;
  color: string;
  rgb: string;
}

function Connector({ status, color, rgb }: ConnectorProps) {
  const isLit = status === 'active' || status === 'complete';

  return (
    <div className="relative flex h-px flex-1 items-center overflow-hidden bg-border mx-1.5">
      {isLit && (
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${color}cc, ${color})` }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      )}
      {status === 'active' && (
        <>
          <div
            className="particle"
            style={{
              background: color,
              boxShadow: `0 0 8px rgba(${rgb}, 0.9), 0 0 16px rgba(${rgb}, 0.4)`,
              width: '5px',
              height: '5px',
            }}
          />
          <div
            className="particle particle-delayed-1"
            style={{
              background: color,
              boxShadow: `0 0 6px rgba(${rgb}, 0.7)`,
              width: '4px',
              height: '4px',
              opacity: 0.8,
            }}
          />
          <div
            className="particle particle-delayed-2"
            style={{
              background: color,
              boxShadow: `0 0 4px rgba(${rgb}, 0.5)`,
              width: '3px',
              height: '3px',
              opacity: 0.6,
            }}
          />
        </>
      )}
    </div>
  );
}

interface NodeCardProps {
  stage: StageNode;
  status: NodeStatus;
}

function NodeCard({ stage, status }: NodeCardProps) {
  const Icon = stage.icon;
  const isActive = status === 'active';
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isIdle = status === 'idle';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {isActive && (
          <>
            <div
              className="ring-expand absolute inset-0 rounded-2xl border"
              style={{ borderColor: `rgba(${stage.rgb}, 0.5)` }}
            />
            <div
              className="ring-expand-delay absolute inset-0 rounded-2xl border"
              style={{ borderColor: `rgba(${stage.rgb}, 0.3)` }}
            />
          </>
        )}

        <motion.div
          key={`${stage.id}-${status}`}
          initial={isActive ? { scale: 0.72, opacity: 0 } : { scale: 1, opacity: 1 }}
          animate={
            isActive
              ? { scale: [1, 1.07, 1], opacity: 1 }
              : { scale: 1, opacity: 1 }
          }
          transition={
            isActive
              ? { duration: 1.7, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.25 }
          }
          className={clsx(
            'relative flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-colors duration-300',
            isIdle && 'border-border bg-bg-hover',
            isError && 'border-red-500/50 bg-red-500/10',
          )}
          style={
            isActive
              ? {
                  borderColor: stage.color,
                  background: `rgba(${stage.rgb}, 0.14)`,
                }
              : isComplete
              ? {
                  borderColor: `rgba(${stage.rgb}, 0.5)`,
                  background: `rgba(${stage.rgb}, 0.07)`,
                }
              : undefined
          }
        >
          {isActive && (
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                boxShadow: `0 0 18px rgba(${stage.rgb}, 0.45), 0 0 36px rgba(${stage.rgb}, 0.18), inset 0 0 10px rgba(${stage.rgb}, 0.06)`,
              }}
            />
          )}

          {isActive ? (
            <Loader2
              size={17}
              className="animate-spin relative z-10"
              style={{ color: stage.color }}
            />
          ) : isComplete ? (
            <CheckCircle2 size={17} style={{ color: stage.color }} className="relative z-10" />
          ) : isError ? (
            <AlertCircle size={17} className="text-red-400 relative z-10" />
          ) : (
            <Icon size={17} className="text-text-muted relative z-10" />
          )}
        </motion.div>
      </div>

      <div className="text-center">
        <p
          className="text-[10px] font-semibold leading-none whitespace-nowrap"
          style={
            isActive
              ? { color: stage.color }
              : isComplete
              ? { color: `rgba(${stage.rgb}, 0.7)` }
              : undefined
          }
        >
          <span className={clsx(!isActive && !isComplete && 'text-text-muted')}>
            {stage.label}
          </span>
        </p>
      </div>
    </div>
  );
}

const DETAIL_VARIANTS = {
  initial: { opacity: 0, y: 6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.97 },
};

interface Props {
  state: QueryState;
  hideHeader?: boolean;
}

export function QueryVisualizer({ state, hideHeader = false }: Props) {
  const { stage, question, sources, streamingAnswer, processingTime } = state;

  return (
    <div className="flex flex-col h-full rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] overflow-hidden">
      {/* Header */}
      {!hideHeader && (
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1c1c1f] shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">RAG Pipeline</h3>
          <p className="text-[11px] text-text-muted mt-0.5 truncate max-w-[220px]">
            {question
              ? `"${question.slice(0, 48)}${question.length > 48 ? '…' : ''}"`
              : 'Awaiting query…'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {processingTime && stage === 'complete' && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 font-mono text-[11px] text-emerald-400"
            >
              <Clock size={10} />
              {processingTime.toFixed(2)}s
            </motion.span>
          )}
          <span
            className={clsx(
              'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              stage === 'idle' && 'border-[#1c1c1f] text-[#71717a] bg-[#121215]',
              stage === 'complete' && 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
              stage === 'error' && 'border-red-500/20 bg-red-500/5 text-red-400',
              ['embedding', 'retrieving', 'reranking', 'generating'].includes(stage) &&
                'border-orange-500/20 bg-orange-500/10 text-orange-500',
            )}
          >
            {stage}
          </span>
        </div>
      </div>
      )}

      {/* Horizontal pipeline flow */}
      <div className="px-4 pt-5 pb-3 shrink-0 overflow-x-auto">
        <div className="flex items-start min-w-max">
          {STAGES.map((stageNode, i) => {
            const nodeStatus = getNodeStatus(stageNode.id, stage);
            const connStatus = getConnectorStatus(stageNode.id, stage);

            return (
              <div key={stageNode.id} className="flex items-center flex-shrink-0">
                <NodeCard stage={stageNode} status={nodeStatus} />
                {i < STAGES.length - 1 && (
                  <div className="flex-shrink-0 mt-[-18px] w-8 sm:w-12">
                    <Connector status={connStatus} color={stageNode.color} rgb={stageNode.rgb} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage detail card */}
      <div className="px-4 pb-3 shrink-0">
        <AnimatePresence mode="wait">
          {stage === 'embedding' && (
            <motion.div
              key="embed-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="rounded-xl border px-3.5 py-2.5"
              style={{ borderColor: 'rgba(244,131,31,0.3)', background: 'rgba(244,131,31,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#F4831F' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#F4831F' }} />
                </span>
                <p className="text-[11px] font-medium" style={{ color: '#F4831F' }}>
                  Vectorizing query · NVIDIA NV-EmbedQA-E5-v5
                </p>
              </div>
            </motion.div>
          )}

          {stage === 'retrieving' && (
            <motion.div
              key="retrieve-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="rounded-xl border px-3.5 py-2.5"
              style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#3b82f6' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#3b82f6' }} />
                </span>
                <p className="text-[11px] font-medium" style={{ color: '#3b82f6' }}>
                  Pinecone ANN search · cosine similarity · over-fetching candidates…
                </p>
              </div>
            </motion.div>
          )}

          {stage === 'reranking' && (
            <motion.div
              key="rerank-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="rounded-xl border px-3.5 py-2.5"
              style={{ borderColor: 'rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#f97316' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#f97316' }} />
                </span>
                <p className="text-[11px] font-medium" style={{ color: '#f97316' }}>
                  NVIDIA llama-3.2-nv-rerankqa-1b-v2 · cross-encoder scoring…
                </p>
              </div>
            </motion.div>
          )}

          {stage === 'generating' && (
            <motion.div
              key="gen-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="rounded-xl border px-3.5 py-2.5 space-y-2"
              style={{ borderColor: 'rgba(236,72,153,0.3)', background: 'rgba(236,72,153,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#ec4899' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#ec4899' }} />
                </span>
                <p className="text-[11px] font-medium" style={{ color: '#ec4899' }}>
                  Llama-3.3-70B synthesizing response…
                </p>
              </div>
              {streamingAnswer && (
                <p className="text-[11px] leading-relaxed text-text-secondary line-clamp-2 pl-4">
                  {streamingAnswer.slice(0, 120)}
                  <span
                    className="inline-block w-0.5 h-3 ml-0.5 animate-pulse align-text-bottom rounded-full"
                    style={{ background: '#ec4899' }}
                  />
                </p>
              )}
            </motion.div>
          )}

          {stage === 'complete' && (
            <motion.div
              key="complete-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="rounded-xl border border-accent-green/25 bg-accent-green/7 px-3.5 py-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-accent-green" />
                  <p className="text-[11px] font-semibold text-accent-green">Pipeline complete</p>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <Hash size={9} />
                    {sources.length} sources
                  </span>
                  {processingTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      {processingTime.toFixed(2)}s
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {stage === 'error' && (
            <motion.div
              key="error-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="rounded-xl border border-red-500/25 bg-red-500/7 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={12} className="text-red-400" />
                <p className="text-[11px] font-medium text-red-400">Pipeline error — please retry</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-3 shrink-0">
        {[
          { label: 'Stage', value: stage, mono: false },
          { label: 'Sources', value: String(sources.length), mono: true },
          { label: 'Latency', value: processingTime ? `${processingTime.toFixed(2)}s` : '—', mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label} className="rounded-xl border border-[#1c1c1f] bg-[#121215] px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#71717a]">{label}</p>
            <p
              className={clsx(
                'mt-1.5 text-xs font-semibold capitalize text-white',
                mono && 'font-mono text-[11px]',
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Sources list */}
      <AnimatePresence>
        {sources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-1 overflow-y-auto px-4 pb-4 min-h-0"
          >
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#71717a]">
              Retrieved Sources
            </p>
            <div className="space-y-1.5">
              {sources.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl border border-[#1c1c1f] bg-[#121215] px-3 py-2"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-orange-500/10 border border-orange-500/20">
                    <span className="font-mono text-[9px] font-bold text-orange-500">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">{s.original_name}</p>
                    <p className="line-clamp-1 text-[10px] text-[#71717a]">{s.text?.slice(0, 65)}…</p>
                  </div>
                  <div
                    className="shrink-0 font-mono text-[10px] font-bold"
                    style={{
                      color:
                        s.score > 0.8
                          ? '#10b981'
                          : s.score > 0.6
                          ? '#f59e0b'
                          : '#71717a',
                    }}
                  >
                    {(s.score * 100).toFixed(0)}%
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
