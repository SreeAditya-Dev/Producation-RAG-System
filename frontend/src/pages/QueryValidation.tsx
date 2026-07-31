import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  FileCheck,
  Filter,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  Cpu,
  Lock,
  MessageSquare,
  BarChart3,
  BookOpen
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { queryApi } from '../services/api';
import type { ValidationMetricItem } from '../types';

type ModalTab = 'overview' | 'latency' | 'sources' | 'security';

export function QueryValidation() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cragFilter, setCragFilter] = useState<string>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all');
  const [selectedQuery, setSelectedQuery] = useState<ValidationMetricItem | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['validationMetrics', page, limit, search, statusFilter, cragFilter, feedbackFilter],
    queryFn: () =>
      queryApi
        .getValidationMetrics({
          page,
          limit,
          search: search || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          crag_grade: cragFilter !== 'all' ? cragFilter : undefined,
          feedback: feedbackFilter !== 'all' ? feedbackFilter : undefined,
        })
        .then((r) => r.data),
    refetchInterval: 15000,
  });

  const summary = data?.summary;
  const items = data?.items ?? [];
  const totalPages = data?.pages ?? 1;
  const totalItems = data?.total ?? 0;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-3 sm:px-6 py-4 pb-16">
      {/* ── Page Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Query Validation & Observability
              </h1>
              <p className="text-xs sm:text-sm text-gray-400">
                Real-time telemetry, stage latencies, CRAG evaluation grades, and citation grounding metrics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#18181b] hover:bg-[#27272a] text-gray-200 rounded-xl border border-white/10 text-xs font-semibold shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5 text-emerald-400', isFetching && 'animate-spin')} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Queries */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#09090b]/80 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-indigo-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Executions</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-3 font-mono">
            {summary?.total_queries ?? 0}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Logged pipeline query runs</p>
        </div>

        {/* Avg Latency */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#09090b]/80 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Avg Latency</span>
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-3 font-mono">
            {summary?.avg_total_ms ? `${(summary.avg_total_ms / 1000).toFixed(2)}s` : '0.00s'}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">End-to-end processing time</p>
        </div>

        {/* CRAG Evaluation */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#09090b]/80 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">CRAG Evaluator</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 mt-3 font-mono text-xs font-bold">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {summary?.crag_grades?.correct ?? 0} Correct
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {summary?.crag_grades?.ambiguous ?? 0} Ambig
            </span>
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              {summary?.crag_grades?.incorrect ?? 0} Incorr
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">Corrective RAG Evaluation</p>
        </div>

        {/* Citation Validity */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#09090b]/80 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Citation Validity</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-3 font-mono">
            {summary?.citation_valid_pct ?? 100}%
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <ThumbsUp className="h-3 w-3" /> {summary?.positive_feedback ?? 0}
            </span>
            <span className="flex items-center gap-1 text-red-400 font-semibold">
              <ThumbsDown className="h-3 w-3" /> {summary?.negative_feedback ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/5 bg-[#09090b]/90 p-4 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by question, answer, or query ID..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-[#121215] border border-white/10 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all duration-200"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Group */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#121215] border border-white/10 px-3 py-2 rounded-xl text-xs text-gray-300">
              <Filter className="h-3.5 w-3.5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-gray-200 focus:outline-none cursor-pointer font-medium"
              >
                <option value="all" className="bg-[#121215]">Status: All</option>
                <option value="success" className="bg-[#121215]">Success</option>
                <option value="error" className="bg-[#121215]">Error</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-[#121215] border border-white/10 px-3 py-2 rounded-xl text-xs text-gray-300">
              <select
                value={cragFilter}
                onChange={(e) => { setCragFilter(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-gray-200 focus:outline-none cursor-pointer font-medium"
              >
                <option value="all" className="bg-[#121215]">CRAG: All</option>
                <option value="correct" className="bg-[#121215]">Correct</option>
                <option value="ambiguous" className="bg-[#121215]">Ambiguous</option>
                <option value="incorrect" className="bg-[#121215]">Incorrect</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-[#121215] border border-white/10 px-3 py-2 rounded-xl text-xs text-gray-300">
              <select
                value={feedbackFilter}
                onChange={(e) => { setFeedbackFilter(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-gray-200 focus:outline-none cursor-pointer font-medium"
              >
                <option value="all" className="bg-[#121215]">Feedback: All</option>
                <option value="up" className="bg-[#121215]">Thumbs Up</option>
                <option value="down" className="bg-[#121215]">Thumbs Down</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-[#121215] border border-white/10 px-3 py-2 rounded-xl text-xs text-gray-300">
              <span className="text-gray-400">Rows:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-transparent border-none text-emerald-400 focus:outline-none cursor-pointer font-bold"
              >
                <option value={10} className="bg-[#121215]">10</option>
                <option value={20} className="bg-[#121215]">20</option>
                <option value={50} className="bg-[#121215]">50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table Container ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-[#09090b]/90 shadow-2xl overflow-hidden backdrop-blur-xl">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-xs font-semibold text-gray-300">Loading query metrics telemetry...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center px-4 space-y-3">
            <ShieldAlert className="h-10 w-10 text-gray-600" />
            <div>
              <p className="text-sm font-bold text-gray-200">No Query Metrics Found</p>
              <p className="text-xs text-gray-500 max-w-sm mt-0.5">
                No telemetry records match your current filters or search terms.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#121215] text-[10px] uppercase font-bold tracking-wider text-gray-400 border-b border-white/5">
                <tr>
                  <th className="py-3.5 px-4 min-w-[110px]">Query ID</th>
                  <th className="py-3.5 px-4 min-w-[260px]">Question</th>
                  <th className="py-3.5 px-4 min-w-[100px]">Status</th>
                  <th className="py-3.5 px-4 min-w-[90px]">Latency</th>
                  <th className="py-3.5 px-4 min-w-[110px]">CRAG Grade</th>
                  <th className="py-3.5 px-4 min-w-[90px]">Max Score</th>
                  <th className="py-3.5 px-4 min-w-[110px]">Citations</th>
                  <th className="py-3.5 px-4 min-w-[100px]">Feedback</th>
                  <th className="py-3.5 px-4 text-right min-w-[80px]">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {items.map((item) => {
                  const latencySec = item.total_ms ? (item.total_ms / 1000).toFixed(2) : (item.processing_time || 0).toFixed(2);
                  const isSuccess = item.status === 'success';

                  return (
                    <tr
                      key={item.query_id}
                      className="hover:bg-white/[0.03] transition-colors duration-150 group"
                    >
                      <td className="py-3.5 px-4 text-emerald-400 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[80px]">{item.query_id}</span>
                          <button
                            onClick={() => copyToClipboard(item.query_id, item.query_id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition"
                            title="Copy Query ID"
                          >
                            {copiedId === item.query_id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-sans text-gray-200 font-medium">
                        <p className="line-clamp-1 max-w-[280px]">{item.question}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          )}
                        >
                          {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {item.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-gray-300 font-bold">
                        {latencySec}s
                      </td>

                      <td className="py-3.5 px-4">
                        {item.crag_grade ? (
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border',
                              item.crag_grade === 'correct' && 'bg-emerald-950 text-emerald-400 border-emerald-800/60',
                              item.crag_grade === 'ambiguous' && 'bg-amber-950 text-amber-400 border-amber-800/60',
                              item.crag_grade === 'incorrect' && 'bg-red-950 text-red-400 border-red-800/60'
                            )}
                          >
                            {item.crag_grade}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-gray-300 font-semibold">
                        {item.retrieval_score_max ? item.retrieval_score_max.toFixed(3) : 'N/A'}
                      </td>

                      <td className="py-3.5 px-4">
                        {item.citation_valid !== null ? (
                          item.citation_valid ? (
                            <span className="text-emerald-400 font-semibold inline-flex items-center gap-1 font-sans text-[11px]">
                              <CheckCircle2 className="h-3 w-3" /> Valid ({item.citation_cited_source_count ?? 0})
                            </span>
                          ) : (
                            <span className="text-red-400 font-semibold inline-flex items-center gap-1 font-sans text-[11px]">
                              <AlertCircle className="h-3 w-3" /> Invalid
                            </span>
                          )
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-sans text-xs">
                        {item.feedback_rating === 'up' && (
                          <span className="text-emerald-400 inline-flex items-center gap-1">
                            <ThumbsUp className="h-3.5 w-3.5" /> Like
                          </span>
                        )}
                        {item.feedback_rating === 'down' && (
                          <span className="text-red-400 inline-flex items-center gap-1 font-semibold">
                            <ThumbsDown className="h-3.5 w-3.5" /> Dislike
                          </span>
                        )}
                        {!item.feedback_rating && <span className="text-gray-600">—</span>}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => { setSelectedQuery(item); setActiveTab('overview'); }}
                          className="p-1.5 bg-[#18181b] hover:bg-emerald-600 text-gray-300 hover:text-white rounded-lg transition shadow-md active:scale-95"
                          title="Inspect Detailed Diagnostics"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Footer ─────────────────────────────────────────────────── */}
        <div className="bg-[#0d0d11] border-t border-white/5 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
          <div>
            Showing <span className="font-bold text-gray-200">{items.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
            <span className="font-bold text-gray-200">{Math.min(page * limit, totalItems)}</span> of{' '}
            <span className="font-bold text-gray-200">{totalItems}</span> queries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#18181b] border border-white/10 text-gray-300 hover:bg-[#27272a] hover:text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>

            <span className="px-2 font-medium text-gray-300">
              Page <span className="text-emerald-400 font-bold">{page}</span> of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#18181b] border border-white/10 text-gray-300 hover:bg-[#27272a] hover:text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Centered Multi-Tab Diagnostic Modal View ────────────────────────────── */}
      {selectedQuery && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 transition-all duration-300 animate-in fade-in">
          <div className="w-full max-w-4xl bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header & Title */}
            <div className="bg-[#121215] border-b border-white/10 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Query Telemetry & Diagnostics
                  </h2>
                  <p className="text-[11px] text-gray-400 font-mono">Query ID: {selectedQuery.query_id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedQuery(null)}
                className="p-1.5 text-gray-400 hover:text-white bg-[#18181b] hover:bg-gray-800 rounded-xl transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="bg-[#0d0d11] border-b border-white/10 px-5 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
              <button
                onClick={() => setActiveTab('overview')}
                className={clsx(
                  'flex items-center gap-2 py-3 px-3 border-b-2 transition-all duration-150',
                  activeTab === 'overview'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                )}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Overview & Q/A</span>
              </button>

              <button
                onClick={() => setActiveTab('latency')}
                className={clsx(
                  'flex items-center gap-2 py-3 px-3 border-b-2 transition-all duration-150',
                  activeTab === 'latency'
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Latency Waterfall</span>
              </button>

              <button
                onClick={() => setActiveTab('sources')}
                className={clsx(
                  'flex items-center gap-2 py-3 px-3 border-b-2 transition-all duration-150',
                  activeTab === 'sources'
                    ? 'border-indigo-400 text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                )}
              >
                <BookOpen className="h-4 w-4" />
                <span>Retrieved Chunks ({selectedQuery.sources?.length ?? 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('security')}
                className={clsx(
                  'flex items-center gap-2 py-3 px-3 border-b-2 transition-all duration-150',
                  activeTab === 'security'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                )}
              >
                <Lock className="h-4 w-4" />
                <span>Security & Guardrails</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              
              {/* TAB 1: OVERVIEW & QA */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-[#121215] border border-white/10 rounded-xl">
                      <span className="text-gray-400 text-[10px] font-medium block uppercase">Total Latency</span>
                      <span className="text-emerald-400 font-mono font-bold text-sm">
                        {selectedQuery.total_ms ? `${(selectedQuery.total_ms / 1000).toFixed(2)}s` : `${(selectedQuery.processing_time || 0).toFixed(2)}s`}
                      </span>
                    </div>

                    <div className="p-3 bg-[#121215] border border-white/10 rounded-xl">
                      <span className="text-gray-400 text-[10px] font-medium block uppercase">Prompt Tokens</span>
                      <span className="text-indigo-400 font-mono font-bold text-sm">{selectedQuery.prompt_tokens ?? 'N/A'}</span>
                    </div>

                    <div className="p-3 bg-[#121215] border border-white/10 rounded-xl">
                      <span className="text-gray-400 text-[10px] font-medium block uppercase">Completion Tokens</span>
                      <span className="text-blue-400 font-mono font-bold text-sm">{selectedQuery.completion_tokens ?? 'N/A'}</span>
                    </div>

                    <div className="p-3 bg-[#121215] border border-white/10 rounded-xl">
                      <span className="text-gray-400 text-[10px] font-medium block uppercase">Cache / Retry</span>
                      <span className="text-amber-400 font-mono font-bold text-xs">
                        {selectedQuery.retry_attempt_count && selectedQuery.retry_attempt_count > 0
                          ? `Retry: ${selectedQuery.retry_reason}`
                          : selectedQuery.cache_type || 'Fresh Run'}
                      </span>
                    </div>
                  </div>

                  {/* Question */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold uppercase tracking-wider">
                      <span>User Prompt</span>
                      <button
                        onClick={() => copyToClipboard(selectedQuery.question, 'q-text')}
                        className="text-emerald-400 hover:underline flex items-center gap-1 font-sans text-xs"
                      >
                        <Copy className="h-3 w-3" /> Copy Prompt
                      </button>
                    </div>
                    <div className="p-4 bg-[#121215] border border-white/10 rounded-xl text-gray-100 font-medium leading-relaxed font-sans text-sm">
                      {selectedQuery.question}
                    </div>
                  </div>

                  {/* Answer */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold uppercase tracking-wider">
                      <span>RAG Generated Answer</span>
                      {selectedQuery.answer && (
                        <button
                          onClick={() => copyToClipboard(selectedQuery.answer || '', 'a-text')}
                          className="text-emerald-400 hover:underline flex items-center gap-1 font-sans text-xs"
                        >
                          <Copy className="h-3 w-3" /> Copy Answer
                        </button>
                      )}
                    </div>
                    <div className="p-4 bg-[#121215] border border-white/10 rounded-xl text-gray-300 leading-relaxed font-sans whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {selectedQuery.answer || <span className="text-gray-500 italic">No answer content recorded.</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LATENCY WATERFALL */}
              {activeTab === 'latency' && (
                <div className="space-y-5">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Pipeline Stage Execution Breakdown</h3>
                  
                  <div className="space-y-4">
                    {/* Embedding */}
                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                        <span>1. Embedding Query</span>
                        <span className="text-blue-400 font-bold">{selectedQuery.embed_ms ? `${selectedQuery.embed_ms}ms` : '—'}</span>
                      </div>
                      <div className="w-full bg-[#18181b] h-3 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="bg-blue-500 h-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, ((selectedQuery.embed_ms || 0) / (selectedQuery.total_ms || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Retrieval */}
                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                        <span>2. Dense Vector & Lexical BM25 Search</span>
                        <span className="text-indigo-400 font-bold">{selectedQuery.retrieve_ms ? `${selectedQuery.retrieve_ms}ms` : '—'}</span>
                      </div>
                      <div className="w-full bg-[#18181b] h-3 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="bg-indigo-500 h-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, ((selectedQuery.retrieve_ms || 0) / (selectedQuery.total_ms || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Reranker */}
                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                        <span>3. NVIDIA Neural Reranking</span>
                        <span className="text-amber-400 font-bold">{selectedQuery.rerank_ms ? `${selectedQuery.rerank_ms}ms` : '—'}</span>
                      </div>
                      <div className="w-full bg-[#18181b] h-3 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="bg-amber-500 h-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, ((selectedQuery.rerank_ms || 0) / (selectedQuery.total_ms || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* LLM Streaming */}
                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                        <span>4. Llama 3.1 LLM Token Streaming</span>
                        <span className="text-emerald-400 font-bold">{selectedQuery.llm_ms ? `${selectedQuery.llm_ms}ms` : '—'}</span>
                      </div>
                      <div className="w-full bg-[#18181b] h-3 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, ((selectedQuery.llm_ms || 0) / (selectedQuery.total_ms || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: RETRIEVED SOURCES */}
              {activeTab === 'sources' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Context Chunks Injected into Prompt ({selectedQuery.sources?.length ?? 0})
                  </h3>

                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {selectedQuery.sources?.map((source, idx) => (
                      <div key={idx} className="p-4 bg-[#121215] border border-white/10 rounded-xl space-y-2 font-mono">
                        <div className="flex items-center justify-between text-gray-300">
                          <span className="text-emerald-400 font-bold">[S{idx + 1}] {source.original_name}</span>
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                            Similarity Score: {source.score?.toFixed(4) ?? 'N/A'}
                          </span>
                        </div>
                        <p className="text-gray-300 font-sans text-xs leading-relaxed whitespace-pre-wrap">
                          {source.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: SECURITY & GUARDRAILS */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Security, Masking & Grounding Verification</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                    <div className="p-4 bg-[#121215] border border-white/10 rounded-xl space-y-1.5">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">PII/PCI Masking Policy</span>
                      <span className="text-emerald-400 font-bold block text-sm">Strategy 1 Active</span>
                      <span className="text-gray-400 text-xs font-sans block">
                        First-4 and Last-4 Card Masking (e.g. 4532-XXXX-XXXX-6789)
                      </span>
                    </div>

                    <div className="p-4 bg-[#121215] border border-white/10 rounded-xl space-y-1.5">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Citation Verification</span>
                      <span className={clsx("font-bold block text-sm", selectedQuery.citation_valid ? "text-emerald-400" : "text-red-400")}>
                        {selectedQuery.citation_valid ? "Valid Grounding" : "Citation Failure"}
                      </span>
                      <span className="text-gray-400 text-xs font-sans block">
                        Cited sources: {selectedQuery.citation_cited_source_count ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-[#121215] border-t border-white/10 px-5 py-3.5 flex items-center justify-end">
              <button
                onClick={() => setSelectedQuery(null)}
                className="px-5 py-2 bg-[#18181b] hover:bg-[#27272a] text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
