import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
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
  Timer,
  Coins,
  ShieldCheck,
  TriangleAlert,
  TrendingUp,
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

  const { data: obs } = useQuery({
    queryKey: ['observability'],
    queryFn: () => systemApi.observability().then((r) => r.data),
    refetchInterval: 15000,
  });

  const recentEvents = eventLog.slice(0, 8);
  const activeCount = [pipeline.stage !== 'idle', queryState.stage !== 'idle' && queryState.stage !== 'complete'].filter(Boolean).length;
  const readiness = stats?.total_documents ? Math.min(100, 35 + stats.total_documents * 8 + (health?.qdrant === 'connected' ? 20 : 0)) : 28;
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

        {/* ══ Observability Panel ══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-[24px] border border-border bg-bg-card/90 shadow-card overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Live Observability</p>
              <h3 className="mt-1 text-base font-semibold text-text-primary">Latency · Tokens · Retrieval · Faithfulness · Failures</h3>
            </div>
            <TrendingUp size={16} className="text-accent-indigo-light shrink-0" />
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-5">
            {/* ── Latency ── */}
            <div className="bg-bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Timer size={13} className="text-blue-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-400">Latency</p>
              </div>
              {[
                { label: 'Avg total', value: obs?.latency.avg_total_ms != null ? `${obs.latency.avg_total_ms.toFixed(0)} ms` : '—' },
                { label: 'p95 total', value: obs?.latency.p95_total_ms != null ? `${obs.latency.p95_total_ms.toFixed(0)} ms` : '—' },
                { label: 'Embed', value: obs?.latency.avg_embed_ms != null ? `${obs.latency.avg_embed_ms.toFixed(0)} ms` : '—' },
                { label: 'Retrieve', value: obs?.latency.avg_retrieve_ms != null ? `${obs.latency.avg_retrieve_ms.toFixed(0)} ms` : '—' },
                { label: 'Rerank', value: obs?.latency.avg_rerank_ms != null ? `${obs.latency.avg_rerank_ms.toFixed(0)} ms` : '—' },
                { label: 'LLM', value: obs?.latency.avg_llm_ms != null ? `${obs.latency.avg_llm_ms.toFixed(0)} ms` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">{label}</span>
                  <span className="font-mono text-[11px] font-semibold text-text-primary">{value}</span>
                </div>
              ))}
            </div>

            {/* ── Tokens ── */}
            <div className="bg-bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Coins size={13} className="text-amber-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">Token Usage</p>
              </div>
              {[
                { label: 'Avg prompt', value: obs?.tokens.avg_prompt_tokens != null ? `${obs.tokens.avg_prompt_tokens.toFixed(0)} tk` : '—' },
                { label: 'Avg completion', value: obs?.tokens.avg_completion_tokens != null ? `${obs.tokens.avg_completion_tokens.toFixed(0)} tk` : '—' },
                { label: 'Total prompt', value: obs?.tokens.total_prompt_tokens ? obs.tokens.total_prompt_tokens.toLocaleString() : '—' },
                { label: 'Total completion', value: obs?.tokens.total_completion_tokens ? obs.tokens.total_completion_tokens.toLocaleString() : '—' },
                { label: 'Avg embed', value: obs?.tokens.avg_embed_tokens != null ? `${obs.tokens.avg_embed_tokens.toFixed(0)} tk` : '—' },
                { label: 'Total embed', value: obs?.tokens.total_embed_tokens ? obs.tokens.total_embed_tokens.toLocaleString() : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">{label}</span>
                  <span className="font-mono text-[11px] font-semibold text-text-primary">{value}</span>
                </div>
              ))}
            </div>

            {/* ── Retrieval quality ── */}
            <div className="bg-bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Radar size={13} className="text-emerald-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">Retrieval</p>
              </div>
              {[
                { label: 'Avg cosine mean', value: obs?.retrieval.avg_score_mean != null ? obs.retrieval.avg_score_mean.toFixed(3) : '—' },
                { label: 'Avg cosine max', value: obs?.retrieval.avg_score_max != null ? obs.retrieval.avg_score_max.toFixed(3) : '—' },
                { label: 'Avg rerank top', value: obs?.retrieval.avg_rerank_top != null ? obs.retrieval.avg_rerank_top.toFixed(3) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">{label}</span>
                  <span className="font-mono text-[11px] font-semibold text-text-primary">{value}</span>
                </div>
              ))}

              {/* Faithfulness */}
              <div className="pt-1 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={13} className="text-purple-400" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-400">Faithfulness</p>
                </div>
                {(() => {
                  const f = obs?.retrieval.avg_faithfulness;
                  const pct = f != null ? Math.round(f * 100) : null;
                  const color = pct == null ? 'bg-text-muted' : pct >= 70 ? 'bg-accent-green' : pct >= 40 ? 'bg-accent-orange' : 'bg-accent-red';
                  return (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-text-muted">Avg score</span>
                        <span className={clsx('font-mono text-[11px] font-bold', pct == null ? 'text-text-muted' : pct >= 70 ? 'text-accent-green' : pct >= 40 ? 'text-accent-orange' : 'text-accent-red')}>
                          {pct != null ? `${pct}%` : '—'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/5">
                        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: pct != null ? `${pct}%` : '0%' }} />
                      </div>
                      {(obs?.retrieval.low_faithfulness_count ?? 0) > 0 && (
                        <p className="mt-1.5 text-[10px] text-accent-orange">
                          ⚠ {obs?.retrieval.low_faithfulness_count} low-score {'queries'}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── Ingestion latency ── */}
            <div className="bg-bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Upload size={13} className="text-blue-300" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-300">Ingestion</p>
              </div>
              {[
                { label: 'Avg total', value: obs?.ingestion_latency.avg_total_ms != null ? `${obs.ingestion_latency.avg_total_ms.toFixed(0)} ms` : '—' },
                { label: 'Download', value: obs?.ingestion_latency.avg_download_ms != null ? `${obs.ingestion_latency.avg_download_ms.toFixed(0)} ms` : '—' },
                { label: 'Parse', value: obs?.ingestion_latency.avg_parse_ms != null ? `${obs.ingestion_latency.avg_parse_ms.toFixed(0)} ms` : '—' },
                { label: 'Chunk', value: obs?.ingestion_latency.avg_chunk_ms != null ? `${obs.ingestion_latency.avg_chunk_ms.toFixed(0)} ms` : '—' },
                { label: 'Embed', value: obs?.ingestion_latency.avg_embed_ms != null ? `${obs.ingestion_latency.avg_embed_ms.toFixed(0)} ms` : '—' },
                { label: 'Store', value: obs?.ingestion_latency.avg_store_ms != null ? `${obs.ingestion_latency.avg_store_ms.toFixed(0)} ms` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">{label}</span>
                  <span className="font-mono text-[11px] font-semibold text-text-primary">{value}</span>
                </div>
              ))}
            </div>

            {/* ── Failures ── */}
            <div className="bg-bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TriangleAlert size={13} className="text-red-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-400">Failures</p>
              </div>
              {[
                {
                  label: 'Query fail rate',
                  value: obs?.failures.query_failure_rate != null
                    ? `${(obs.failures.query_failure_rate * 100).toFixed(1)}%`
                    : '—',
                  bad: (obs?.failures.query_failure_rate ?? 0) > 0.05,
                },
                {
                  label: 'Ingest fail rate',
                  value: obs?.failures.ingestion_failure_rate != null
                    ? `${(obs.failures.ingestion_failure_rate * 100).toFixed(1)}%`
                    : '—',
                  bad: (obs?.failures.ingestion_failure_rate ?? 0) > 0.05,
                },
                {
                  label: 'Failed queries',
                  value: String(obs?.failures.failed_queries ?? 0),
                  bad: (obs?.failures.failed_queries ?? 0) > 0,
                },
                {
                  label: 'Failed ingestions',
                  value: String(obs?.failures.failed_ingestions ?? 0),
                  bad: (obs?.failures.failed_ingestions ?? 0) > 0,
                },
              ].map(({ label, value, bad }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">{label}</span>
                  <span className={clsx('font-mono text-[11px] font-semibold', bad ? 'text-accent-red' : 'text-accent-green')}>
                    {value}
                  </span>
                </div>
              ))}

              {/* Stage breakdown */}
              {obs?.failures.by_stage && Object.keys(obs.failures.by_stage).length > 0 && (
                <div className="pt-1 border-t border-border space-y-1">
                  <p className="text-[10px] text-text-muted uppercase tracking-[0.2em]">By stage</p>
                  {Object.entries(obs.failures.by_stage).map(([stage, count]) => (
                    <div key={stage} className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">{stage}</span>
                      <span className="font-mono text-[10px] text-accent-red">{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent failures */}
              {obs?.failures.recent && obs.failures.recent.length > 0 && (
                <div className="pt-1 border-t border-border">
                  <p className="mb-1.5 text-[10px] text-text-muted uppercase tracking-[0.2em]">Recent</p>
                  <div className="space-y-1.5">
                    {obs.failures.recent.slice(0, 3).map((f, i) => (
                      <div key={i} className="rounded-lg border border-red-500/15 bg-red-500/5 px-2.5 py-1.5">
                        <p className="text-[10px] font-medium text-red-400 capitalize">{f.type} · {f.stage ?? '?'}</p>
                        {f.question && (
                          <p className="mt-0.5 truncate text-[10px] text-text-muted">{f.question}</p>
                        )}
                        <p className="mt-0.5 text-[9px] text-text-muted/60">{f.error_type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

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
                  label: 'Qdrant Vector DB',
                  ok: health?.qdrant === 'connected',
                  tag: health === undefined ? 'Checking…' : health.qdrant === 'connected' ? 'Connected' : 'Not Connected',
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
