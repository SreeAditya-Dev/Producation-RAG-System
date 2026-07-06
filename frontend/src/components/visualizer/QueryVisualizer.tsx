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
    color: '#ffffff',
    rgb: '255,255,255',
    glowClass: '',
  },
  {
    id: 'embed',
    label: 'Embed',
    sublabel: 'NV-EmbedQA',
    icon: Cpu,
    color: '#ffffff',
    rgb: '255,255,255',
    glowClass: '',
  },
  {
    id: 'pinecone',
    label: 'Pinecone',
    sublabel: 'ANN Search',
    icon: Database,
    color: '#ffffff',
    rgb: '255,255,255',
    glowClass: '',
  },
  {
    id: 'retrieve',
    label: 'Retrieve',
    sublabel: 'Top-K Chunks',
    icon: Layers,
    color: '#ffffff',
    rgb: '255,255,255',
    glowClass: '',
  },
  {
    id: 'rerank',
    label: 'Rerank',
    sublabel: 'NIM Reranker',
    icon: SlidersHorizontal,
    color: '#ffffff',
    rgb: '255,255,255',
    glowClass: '',
  },
  {
    id: 'llm',
    label: 'LLM',
    sublabel: 'Llama-3.3-70B',
    icon: Sparkles,
    color: '#ffffff',
    rgb: '255,255,255',
    glowClass: '',
  },
  {
    id: 'answer',
    label: 'Answer',
    sublabel: 'Response Ready',
    icon: CheckCircle2,
    color: '#ffffff',
    rgb: '255,255,255',
    glowClass: '',
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
}

function Connector({ status }: ConnectorProps) {
  const isLit = status === 'active' || status === 'complete';

  return (
    <div className="relative flex h-[1px] flex-1 items-center overflow-hidden bg-zinc-800/80 mx-1">
      {isLit && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-zinc-400"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
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
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <motion.div
          key={`${stage.id}-${status}`}
          initial={{ scale: 1 }}
          className={clsx(
            'relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-300',
            isIdle && 'border-zinc-900 bg-zinc-950 text-zinc-655',
            isActive && 'border-zinc-300 bg-zinc-900 text-zinc-100 shadow-[0_0_8px_rgba(255,255,255,0.05)]',
            isComplete && 'border-zinc-700 bg-zinc-900/30 text-zinc-450',
            isError && 'border-red-500 bg-red-500/5 text-red-400'
          )}
        >
          {isActive ? (
            <Loader2 size={13} className="animate-spin text-zinc-300" />
          ) : isComplete ? (
            <CheckCircle2 size={13} className="text-zinc-450" />
          ) : isError ? (
            <AlertCircle size={13} className="text-red-400" />
          ) : (
            <Icon size={13} className="text-zinc-650" />
          )}
        </motion.div>
      </div>

      <div className="text-center">
        <p
          className={clsx(
            'text-[9px] font-mono leading-none tracking-tight uppercase',
            isActive ? 'text-zinc-200' : isComplete ? 'text-zinc-400' : 'text-zinc-600'
          )}
        >
          {stage.label}
        </p>
      </div>
    </div>
  );
}

const DETAIL_VARIANTS = {
  initial: { opacity: 0, y: 3 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -3 },
};

interface Props {
  state: QueryState;
  hideHeader?: boolean;
}

export function QueryVisualizer({ state, hideHeader = false }: Props) {
  const { stage, question, sources, streamingAnswer, processingTime } = state;

  return (
    <div className="flex flex-col h-full rounded-lg border border-zinc-800 bg-[#0c0c0e] overflow-hidden">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-zinc-300 font-mono uppercase tracking-wider">Pipeline telemetry</h3>
            <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[220px] font-mono">
              {question ? `"${question}"` : 'Awaiting prompt...'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {processingTime && stage === 'complete' && (
              <span className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-0.5 font-mono text-[10px] text-zinc-450">
                <Clock size={10} />
                {processingTime.toFixed(2)}s
              </span>
            )}
            <span
              className={clsx(
                'rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider',
                stage === 'idle' && 'border-zinc-900 text-zinc-655 bg-zinc-950',
                stage === 'complete' && 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
                stage === 'error' && 'border-red-500/20 bg-red-500/5 text-red-400',
                ['embedding', 'retrieving', 'reranking', 'generating'].includes(stage) &&
                  'border-zinc-700 bg-zinc-900/50 text-zinc-300'
              )}
            >
              {stage}
            </span>
          </div>
        </div>
      )}

      {/* Stepper Grid */}
      <div className="px-4 py-4 shrink-0 overflow-x-auto border-b border-zinc-800/40 bg-[#09090b]/20">
        <div className="flex items-start min-w-max justify-between">
          {STAGES.map((stageNode, i) => {
            const nodeStatus = getNodeStatus(stageNode.id, stage);
            const connStatus = getConnectorStatus(stageNode.id, stage);

            return (
              <div key={stageNode.id} className="flex items-center flex-shrink-0">
                <NodeCard stage={stageNode} status={nodeStatus} />
                {i < STAGES.length - 1 && (
                  <div className="flex-shrink-0 mt-[-16px] w-6 sm:w-8">
                    <Connector status={connStatus} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage detail box */}
      <div className="px-4 py-3.5 shrink-0 border-b border-zinc-800/40">
        <AnimatePresence mode="wait">
          {stage === 'embedding' && (
            <motion.div
              key="embed-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-zinc-800 bg-zinc-900/10 px-3 py-2.5"
            >
              <p className="text-[10px] font-mono text-zinc-400">
                Vectorizing prompt &middot; NVIDIA NV-EmbedQA-E5-v5
              </p>
            </motion.div>
          )}

          {stage === 'retrieving' && (
            <motion.div
              key="retrieve-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-zinc-800 bg-zinc-900/10 px-3 py-2.5"
            >
              <p className="text-[10px] font-mono text-zinc-400">
                Pinecone ANN &middot; cosine similarity over-fetching candidate nodes
              </p>
            </motion.div>
          )}

          {stage === 'reranking' && (
            <motion.div
              key="rerank-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-zinc-800 bg-zinc-900/10 px-3 py-2.5"
            >
              <p className="text-[10px] font-mono text-zinc-400">
                NVIDIA Llama Rerank &middot; cross-encoder sequence classification
              </p>
            </motion.div>
          )}

          {stage === 'generating' && (
            <motion.div
              key="gen-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-zinc-800 bg-zinc-900/10 px-3 py-2.5 space-y-2"
            >
              <p className="text-[10px] font-mono text-zinc-400">
                Llama-3.3-70B Nim synthesizing response streams...
              </p>
              {streamingAnswer && (
                <p className="text-[10px] leading-relaxed text-zinc-500 font-mono line-clamp-2 pl-2">
                  {streamingAnswer.slice(0, 120)}
                  <span className="inline-block w-1 h-3 ml-0.5 animate-pulse bg-zinc-400" />
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
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-zinc-800 bg-zinc-900/10 px-3 py-2.5"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="font-semibold text-zinc-300">Pipeline execution ready</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Hash size={10} />
                    {sources.length} sources
                  </span>
                  {processingTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
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
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5"
            >
              <p className="text-[10px] font-mono text-red-400">
                Pipeline execution error &middot; reset UI and retry
              </p>
            </motion.div>
          )}

          {stage === 'idle' && (
            <motion.div
              key="idle-detail"
              variants={DETAIL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-zinc-900 bg-zinc-950 px-3 py-2.5 text-center"
            >
              <p className="text-[10px] font-mono text-zinc-650">Awaiting user query parameters...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 shrink-0 bg-[#09090b]/10">
        {[
          { label: 'Latency', value: processingTime ? `${processingTime.toFixed(2)}s` : '—' },
          { label: 'Sources', value: String(sources.length) },
          { label: 'Stage', value: stage },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
            <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="mt-1 text-xs font-mono font-semibold text-zinc-300 truncate capitalize">{value}</p>
          </div>
        ))}
      </div>

      {/* Sources list */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {sources.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-3">Retrieved candidate segments</p>
            <div className="space-y-1.5">
              {sources.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 rounded-lg border border-zinc-850 bg-zinc-950/30 px-3 py-2 hover:border-zinc-800 transition-colors"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-900 border border-zinc-800">
                    <span className="font-mono text-[9px] text-zinc-400">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-zinc-200">{s.original_name}</p>
                    <p className="line-clamp-1 text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{s.text}</p>
                  </div>
                  <div className="shrink-0 font-mono text-[10px] text-zinc-400">
                    {(s.score * 100).toFixed(0)}%
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full py-8 text-center">
            <p className="text-[10px] font-mono text-zinc-650">No vector source candidates loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}
