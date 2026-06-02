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
                { label: 'Pinecone Vector DB', status: health?.pinecone === 'connected' },
                { label: 'NVIDIA NIM API', status: health?.nvidia === 'configured' },
                { label: 'FastAPI Backend', status: health?.status === 'ok' },
              ].map(({ label, status }) => (
                <div key={label} className="flex items-center justify-between rounded-2xl border border-border bg-black/10 px-4 py-3">
                  <span className="text-sm text-text-secondary">{label}</span>
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${status ? 'bg-accent-green animate-pulse' : 'bg-accent-red'}`} />
                    <span className={`text-xs font-medium ${status ? 'text-accent-green' : 'text-accent-red'}`}>
                      {status ? 'Connected' : 'Error'}
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PipelineVisualizer state={pipeline} />
          <QueryVisualizer state={queryState} />
        </div>
      </div>
    </div>
  );
}
