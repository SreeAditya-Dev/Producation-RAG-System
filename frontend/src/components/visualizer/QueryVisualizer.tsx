import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  MessageSquare,
  Cpu,
  Database,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Hash,
  Terminal,
} from 'lucide-react';
import type { QueryState, QueryStage } from '../../types';

interface StageNode {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const STAGES: StageNode[] = [
  {
    id: 'query',
    label: 'Query Ingestion',
    sublabel: 'Preprocessing query parameters',
    icon: MessageSquare,
  },
  {
    id: 'embed',
    label: 'Embedding Generation',
    sublabel: 'NVIDIA NV-EmbedQA-E5-v5',
    icon: Cpu,
  },
  {
    id: 'pinecone',
    label: 'Vector Database Search',
    sublabel: 'Retrieving candidates from Pinecone',
    icon: Database,
  },
  {
    id: 'rerank',
    label: 'Context Reranking',
    sublabel: 'NVIDIA NIM Cross-Encoder Reranker',
    icon: SlidersHorizontal,
  },
  {
    id: 'llm',
    label: 'Answer Synthesis',
    sublabel: 'Llama-3.1-70B Synthesizer',
    icon: Sparkles,
  },
  {
    id: 'answer',
    label: 'Grounded Response Delivery',
    sublabel: 'Synthesis execution complete',
    icon: CheckCircle2,
  },
];

type NodeStatus = 'idle' | 'active' | 'complete' | 'error';

function getNodeStatus(nodeId: string, current: QueryStage): NodeStatus {
  if (current === 'error') return 'error';
  const order: QueryStage[] = ['idle', 'embedding', 'retrieving', 'reranking', 'generating', 'complete'];
  const cp = order.indexOf(current);

  if (cp === -1) return 'idle';

  switch (nodeId) {
    case 'query':
      return current === 'idle' ? 'idle' : 'complete';
    case 'embed':
      return cp === 1 ? 'active' : cp > 1 ? 'complete' : 'idle';
    case 'pinecone':
      return cp === 2 ? 'active' : cp > 2 ? 'complete' : 'idle';
    case 'rerank':
      return cp === 3 ? 'active' : cp > 3 ? 'complete' : 'idle';
    case 'llm':
      return cp === 4 ? 'active' : cp > 4 ? 'complete' : 'idle';
    case 'answer':
      return cp >= 5 ? 'complete' : 'idle';
    default:
      return 'idle';
  }
}

interface StepProps {
  stageNode: StageNode;
  status: NodeStatus;
  isLast: boolean;
  state: QueryState;
}

function StepRow({ stageNode, status, isLast, state }: StepProps) {
  const Icon = stageNode.icon;
  const isActive = status === 'active';
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isIdle = status === 'idle';

  const { question, sources, streamingAnswer, processingTime } = state;

  return (
    <div className="flex gap-4">
      {/* Indicator Column */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors duration-200 select-none bg-black',
            isIdle && 'border-zinc-800 text-zinc-600',
            isActive && 'border-[#F4831F] text-[#F4831F] bg-[#F4831F]/5 shadow-[0_0_8px_rgba(244,131,31,0.06)]',
            isComplete && 'border-zinc-700 text-zinc-400 bg-zinc-900/30',
            isError && 'border-red-500 text-red-500'
          )}
        >
          {isActive ? (
            <Loader2 size={12} className="animate-spin text-[#F4831F]" />
          ) : isComplete ? (
            <CheckCircle2 size={12} className="text-zinc-400" />
          ) : isError ? (
            <AlertCircle size={12} />
          ) : (
            <Icon size={12} />
          )}
        </div>
        {!isLast && (
          <div className="w-[1px] flex-1 bg-zinc-800 min-h-[30px] my-1 relative">
            {(isComplete || isActive) && (
              <motion.div
                className={clsx(
                  "absolute inset-x-0 top-0",
                  isActive ? "bg-[#F4831F]/60" : "bg-zinc-600"
                )}
                initial={{ height: '0%' }}
                animate={{ height: '100%' }}
                transition={{ duration: 0.3 }}
              />
            )}
          </div>
        )}
      </div>

      {/* Description Column */}
      <div className="flex-1 pb-6">
        <div className="flex items-baseline justify-between">
          <h4
            className={clsx(
              'text-xs font-mono tracking-wider uppercase font-semibold transition-colors duration-200',
              isActive ? 'text-[#F4831F]' : isComplete ? 'text-zinc-400' : 'text-zinc-600'
            )}
          >
            {stageNode.label}
          </h4>
        </div>
        <p
          className={clsx(
            'text-[10px] font-mono mt-0.5 leading-relaxed',
            isActive ? 'text-zinc-200 font-medium' : isComplete ? 'text-zinc-500' : 'text-zinc-600'
          )}
        >
          {stageNode.sublabel}
        </p>

        {/* Inline Execution Metadata Details */}
        <AnimatePresence>
          {(isActive || isComplete) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-md border border-zinc-800 bg-[#09090b]/80 p-2.5 font-mono text-[9px] text-zinc-400 space-y-1">
                {stageNode.id === 'query' && (
                  <div className="space-y-0.5">
                    <div className="text-zinc-550">Query Parameter:</div>
                    <div className="text-zinc-200 leading-normal">"{question || '...'}"</div>
                  </div>
                )}

                {stageNode.id === 'embed' && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><span className="text-zinc-550">Model:</span> NV-EmbedQA</div>
                    <div><span className="text-zinc-550">Dimensions:</span> 1024</div>
                    <div><span className="text-zinc-550">Format:</span> float32</div>
                    <div><span className="text-zinc-555">Engine:</span> NIM</div>
                  </div>
                )}

                {stageNode.id === 'pinecone' && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <div><span className="text-zinc-555">Index:</span> prod-rag</div>
                      <div><span className="text-zinc-550">Metric:</span> Cosine</div>
                    </div>
                    {isComplete && (
                      <div className="border-t border-zinc-900 pt-1 mt-1 text-[8px] text-zinc-500">
                        Candidates Fetched: <span className="text-[#F4831F] font-bold">{sources?.length || 0}</span> chunks
                      </div>
                    )}
                  </div>
                )}

                {stageNode.id === 'rerank' && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <div><span className="text-zinc-550">Cross-Enc:</span> Llama-3-Mini</div>
                    <div><span className="text-zinc-550">Top-K Out:</span> {sources?.length || 0}</div>
                  </div>
                )}

                {stageNode.id === 'llm' && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <div><span className="text-zinc-550">Host:</span> Local-NIM</div>
                      <div><span className="text-zinc-550">Temp:</span> 0.2</div>
                    </div>
                    {streamingAnswer && (
                      <div className="border-t border-zinc-900 pt-1 mt-1 font-mono text-zinc-400 break-words leading-relaxed select-all">
                        {streamingAnswer.slice(0, 140)}
                        {isActive && <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse bg-[#F4831F]" />}
                      </div>
                    )}
                  </div>
                )}

                {stageNode.id === 'answer' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-zinc-450">
                      <span>Pipeline execution ready</span>
                      {processingTime && (
                        <span className="text-[#F4831F] font-bold">{processingTime.toFixed(2)}s latency</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface Props {
  state: QueryState;
  hideHeader?: boolean;
}

export function QueryVisualizer({ state, hideHeader = false }: Props) {
  const { stage, sources, processingTime } = state;

  return (
    <div className="flex flex-col h-full rounded-lg border border-zinc-800 bg-[#000000] overflow-hidden font-sans select-none">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#09090b] shrink-0">
          <div className="min-w-0">
            <h3 className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
              <Terminal size={11} className="text-zinc-500" />
              Pipeline Telemetry
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {processingTime && stage === 'complete' && (
              <span className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/30 px-2 py-0.5 font-mono text-[9px] text-zinc-400">
                <Clock size={9} />
                {processingTime.toFixed(2)}s
              </span>
            )}
            <span
              className={clsx(
                'rounded border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider',
                stage === 'idle' && 'border-zinc-800 text-zinc-500 bg-zinc-950/40',
                stage === 'complete' && 'border-zinc-700 bg-zinc-900/20 text-zinc-300',
                stage === 'error' && 'border-red-950 bg-red-950/20 text-red-405',
                ['embedding', 'retrieving', 'reranking', 'generating'].includes(stage) &&
                  'border-[#F4831F]/30 bg-[#F4831F]/5 text-[#F4831F]'
              )}
            >
              {stage}
            </span>
          </div>
        </div>
      )}

      {/* Stepper Timeline Area */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="flex flex-col">
          {STAGES.map((stageNode, i) => {
            const nodeStatus = getNodeStatus(stageNode.id, stage);
            return (
              <StepRow
                key={stageNode.id}
                stageNode={stageNode}
                status={nodeStatus}
                isLast={i === STAGES.length - 1}
                state={state}
              />
            );
          })}
        </div>
      </div>

      {/* Sources list */}
      <div className="shrink-0 border-t border-zinc-800 bg-[#09090b] p-4 max-h-[160px] overflow-y-auto">
        {sources.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1">
              <Hash size={10} />
              Retrieved Context Nodes ({sources.length})
            </p>
            <div className="space-y-1">
              {sources.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded border border-zinc-900 bg-black px-2 py-1.5 hover:border-zinc-800 transition-colors cursor-pointer"
                >
                  <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded bg-zinc-900 border border-zinc-800">
                    <span className="font-mono text-[8px] text-[#F4831F] font-bold">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold text-zinc-300">{s.original_name}</p>
                    <p className="truncate text-[9px] text-zinc-550 mt-0.5 font-mono">{s.text}</p>
                  </div>
                  <div className="shrink-0 font-mono text-[9px] text-[#F4831F]">
                    {(s.score * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4 text-center">
            <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">No retrieved sources loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}
