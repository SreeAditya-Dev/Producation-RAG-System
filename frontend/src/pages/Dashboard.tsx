import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText,
  Layers,
  MessageSquare,
  Database,
  Activity,
  Zap,
  CheckCircle2,
  ArrowRight,
  Radar,
  TimerReset,
  Workflow,
  Upload,
  Sparkles,
} from 'lucide-react';
import { systemApi } from '../services/api';
import { usePipelineCtx } from '../components/layout/Layout';
import { PipelineVisualizer } from '../components/visualizer/PipelineVisualizer';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-bg-card p-5 transition-colors hover:border-border-light"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{value}</p>
          {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon size={19} className="text-white" />
        </div>
      </div>
    </motion.div>
  );
}

export function Dashboard() {
  const { pipeline, queryState, eventLog } = usePipelineCtx();

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => systemApi.stats().then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => systemApi.health().then((r) => r.data),
    refetchInterval: 30000,
  });

  const recentEvents = eventLog.slice(0, 8);
  const activeCount = [pipeline.stage !== 'idle', queryState.stage !== 'idle' && queryState.stage !== 'complete'].filter(Boolean).length;
  const readiness = stats?.total_documents ? Math.min(100, 35 + stats.total_documents * 8 + (health?.pinecone === 'connected' ? 20 : 0)) : 28;
  const architectureLayers = [
    { label: 'Input Layer', detail: 'Document intake, validation, and file transport.', icon: FileText, tone: 'from-blue-500/20 to-blue-500/5' },
    { label: 'Processing Layer', detail: 'Parsing, chunking, and embedding progression.', icon: Workflow, tone: 'from-purple-500/20 to-purple-500/5' },
    { label: 'Retrieval Layer', detail: 'Vector lookup, ranking, and grounded recall.', icon: Radar, tone: 'from-emerald-500/20 to-emerald-500/5' },
    { label: 'Response Layer', detail: 'Answer synthesis with live traceability.', icon: Zap, tone: 'from-amber-500/20 to-amber-500/5' },
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[28px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-card sm:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-accent-blue/8 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-indigo/30 bg-accent-indigo/10 px-3 py-1 text-xs font-medium text-accent-indigo-light">
                <Activity size={12} />
                Live retrieval command surface
              </div>
              <div>
                <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-text-primary sm:text-5xl">
                  Dynamic RAG dashboard with every layer visible.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                  The UI now frames the system as a full workflow: document intake, vector preparation, retrieval, and grounded response generation, all with live states and mobile-friendly behavior.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Readiness</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{readiness}%</p>
                  <p className="mt-1 text-xs text-text-secondary">Knowledge base and services aligned.</p>
                </div>
                <div className="rounded-2xl border border-border bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Active Flows</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{activeCount}</p>
                  <p className="mt-1 text-xs text-text-secondary">Pipelines currently moving through steps.</p>
                </div>
                <div className="rounded-2xl border border-border bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Event Stream</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{eventLog.length}</p>
                  <p className="mt-1 text-xs text-text-secondary">Recent signals captured for diagnosis.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-text-muted">System Pulse</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">Mission control snapshot</h3>
                </div>
                <TimerReset size={18} className="text-accent-purple" />
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { label: 'Backend health', value: health?.status === 'ok' ? 'Stable' : 'Needs check' },
                  { label: 'Vector index', value: `${stats?.index_stats?.total_vector_count ?? 0} vectors` },
                  { label: 'Last query state', value: queryState.stage === 'idle' ? 'Waiting' : queryState.stage },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-border bg-bg-card/70 px-4 py-3">
                    <span className="text-sm text-text-secondary">{item.label}</span>
                    <span className="text-sm font-medium capitalize text-text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileText} label="Documents" value={stats?.total_documents ?? '—'} sub="indexed & ready" color="bg-accent-purple" />
          <StatCard icon={Layers} label="Vector Chunks" value={stats?.total_chunks ?? '—'} sub="available for retrieval" color="bg-accent-blue" />
          <StatCard icon={MessageSquare} label="Queries Run" value={stats?.total_queries ?? '—'} sub="conversation depth" color="bg-accent-orange" />
          <StatCard
            icon={Database}
            label="Index Vectors"
            value={stats?.index_stats?.total_vector_count ?? '—'}
            sub={`dim: ${stats?.index_stats?.dimension ?? '—'}`}
            color="bg-accent-green"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] border border-border bg-bg-card/90 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">System Layers</p>
                <h3 className="mt-2 text-lg font-semibold text-text-primary">What the UI highlights</h3>
              </div>
              <ArrowRight size={16} className="text-accent-indigo-light" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {architectureLayers.map(({ label, detail, icon: Icon, tone }) => (
                <div key={label} className={`rounded-2xl border border-border bg-gradient-to-br ${tone} p-4`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20">
                    <Icon size={18} className="text-text-primary" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-text-primary">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-bg-card/90 p-5 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Services</p>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: 'FastAPI Backend',
                  ok: health?.status === 'ok',
                  tag: health === undefined ? 'Checking…' : health.status === 'ok' ? 'Online' : 'Offline',
                },
                {
                  label: 'Pinecone Vector DB',
                  ok: health?.pinecone === 'connected',
                  tag: health === undefined ? 'Checking…' : health.pinecone === 'connected' ? 'Connected' : 'Not Connected',
                },
                {
                  label: 'NVIDIA NIM API',
                  ok: health?.nvidia === 'configured',
                  tag: health === undefined ? 'Checking…' : health.nvidia === 'configured' ? 'Configured' : 'Not Configured',
                },
              ].map(({ label, ok, tag }) => (
                <div key={label} className="flex items-center justify-between rounded-2xl border border-border bg-black/10 px-4 py-3">
                  <span className="text-sm text-text-secondary">{label}</span>
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${health === undefined ? 'bg-text-muted' : ok ? 'bg-accent-green animate-pulse' : 'bg-accent-red'}`} />
                    <span className={`text-xs font-medium ${health === undefined ? 'text-text-muted' : ok ? 'text-accent-green' : 'text-accent-red'}`}>
                      {tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-black/10 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-accent-green" />
                <p className="text-sm font-medium text-text-primary">Recent activity</p>
              </div>
              {recentEvents.length === 0 ? (
                <p className="mt-3 text-xs text-text-muted">No events yet. Upload a document to start the full pipeline.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentEvents.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-xs">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          e.type === 'success'
                            ? 'bg-accent-green'
                            : e.type === 'error'
                              ? 'bg-accent-red'
                              : e.type === 'warning'
                                ? 'bg-accent-orange'
                                : 'bg-text-muted'
                        }`}
                      />
                      <span className="truncate text-text-secondary">{e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">

          {/* ══ Row 01 · Ingestion Pipeline ══ */}
          <div className="overflow-hidden rounded-[28px] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.05] via-transparent to-transparent shadow-[0_0_0_1px_rgba(59,130,246,0.06),0_8px_48px_rgba(59,130,246,0.07)]">
            <div className="relative overflow-hidden border-b border-blue-500/15 bg-gradient-to-r from-blue-500/10 via-blue-400/5 to-transparent px-6 py-4">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-400/8 blur-2xl" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/15">
                    <Upload size={18} className="text-blue-400" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-blue-500/40 bg-bg-primary text-[9px] font-black text-blue-400">01</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/60">Stage 01</span>
                      <span className="h-px w-3 bg-blue-400/20" />
                      <span className="text-[10px] text-text-muted">Upload → Parse → Chunk → Embed → Store</span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold text-text-primary">Ingestion Pipeline</h3>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/8 px-3 py-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
                  </span>
                  <span className="text-xs font-semibold text-blue-300">Document Processing</span>
                </div>
              </div>
            </div>
            <PipelineVisualizer state={pipeline} hideHeader />
          </div>

          {/* ══ Row 02 · Query Pipeline ══ */}
          <div className="overflow-hidden rounded-[28px] border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.05] via-transparent to-transparent shadow-[0_0_0_1px_rgba(168,85,247,0.06),0_8px_48px_rgba(168,85,247,0.07)]">
            <div className="relative overflow-hidden border-b border-purple-500/15 bg-gradient-to-r from-purple-500/10 via-purple-400/5 to-transparent px-6 py-4">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-400/8 blur-2xl" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/15">
                    <Sparkles size={18} className="text-purple-400" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-purple-500/40 bg-bg-primary text-[9px] font-black text-purple-400">02</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-400/60">Stage 02</span>
                      <span className="h-px w-3 bg-purple-400/20" />
                      <span className="text-[10px] text-text-muted">Query → Embed → Retrieve → Rerank → LLM → Answer</span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold text-text-primary">Query Pipeline</h3>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/8 px-3 py-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-400" />
                  </span>
                  <span className="text-xs font-semibold text-purple-300">Retrieval & Generation</span>
                </div>
              </div>
            </div>
            <QueryVisualizer state={queryState} hideHeader />
          </div>

        </div>
      </div>
    </div>
  );
}
