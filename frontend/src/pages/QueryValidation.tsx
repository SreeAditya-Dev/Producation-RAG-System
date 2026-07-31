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
  Check
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { queryApi } from '../services/api';
import type { ValidationMetricItem } from '../types';

export function QueryValidation() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cragFilter, setCragFilter] = useState<string>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all');
  const [selectedQuery, setSelectedQuery] = useState<ValidationMetricItem | null>(null);
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
      {/* ── Header ────────────────────────────────────────────────────────────── */}
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
            {/* Status Select */}
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

            {/* CRAG Select */}
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

            {/* Feedback Select */}
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

            {/* Per Page Select */}
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
                      {/* ID */}
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

                      {/* Question */}
                      <td className="py-3.5 px-4 font-sans text-gray-200 font-medium">
                        <p className="line-clamp-1 max-w-[280px]">{item.question}</p>
                      </td>

                      {/* Status */}
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

                      {/* Latency */}
                      <td className="py-3.5 px-4 text-gray-300 font-bold">
                        {latencySec}s
                      </td>

                      {/* CRAG Grade */}
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

                      {/* Max Score */}
                      <td className="py-3.5 px-4 text-gray-300 font-semibold">
                        {item.retrieval_score_max ? item.retrieval_score_max.toFixed(3) : 'N/A'}
                      </td>

                      {/* Citations */}
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

                      {/* Feedback */}
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

                      {/* Inspect Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedQuery(item)}
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

      {/* ── Diagnostic Drawer / Modal ─────────────────────────────────────────── */}
      {selectedQuery && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end p-0 transition-all duration-300">
          <div className="w-full sm:w-[600px] md:w-[680px] bg-[#09090b] border-l border-white/10 h-full overflow-y-auto p-5 sm:p-6 space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div className="space-y-0.5">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-400" />
                    Query Diagnostic Inspector
                  </h2>
                  <p className="text-xs text-gray-400 font-mono">ID: {selectedQuery.query_id}</p>
                </div>
                <button
                  onClick={() => setSelectedQuery(null)}
                  className="p-1.5 text-gray-400 hover:text-white bg-[#18181b] hover:bg-gray-800 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Question & Generated Answer */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">User Question</h3>
                  <div className="p-3.5 bg-[#121215] border border-white/10 rounded-xl text-xs text-gray-100 font-medium leading-relaxed">
                    {selectedQuery.question}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Generated Answer</h3>
                  <div className="p-3.5 bg-[#121215] border border-white/10 rounded-xl text-xs text-gray-300 space-y-2 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                    {selectedQuery.answer || <span className="text-gray-500 italic">No answer content recorded.</span>}
                  </div>
                </div>
              </div>

              {/* Latency Stage Breakdown */}
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Stage Latency Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="p-3 bg-[#121215] border border-white/10 rounded-xl">
                    <span className="text-gray-400 block text-[10px]">Embedding</span>
                    <span className="text-blue-400 font-bold text-sm">{selectedQuery.embed_ms ? `${selectedQuery.embed_ms}ms` : '—'}</span>
                  </div>
                  <div className="p-3 bg-[#121215] border border-white/10 rounded-xl">
                    <span className="text-gray-400 block text-[10px]">Retrieval</span>
                    <span className="text-indigo-400 font-bold text-sm">{selectedQuery.retrieve_ms ? `${selectedQuery.retrieve_ms}ms` : '—'}</span>
                  </div>
                  <div className="p-3 bg-[#121215] border border-white/10 rounded-xl">
                    <span className="text-gray-400 block text-[10px]">Reranking</span>
                    <span className="text-amber-400 font-bold text-sm">{selectedQuery.rerank_ms ? `${selectedQuery.rerank_ms}ms` : '—'}</span>
                  </div>
                  <div className="p-3 bg-[#121215] border border-white/10 rounded-xl">
                    <span className="text-gray-400 block text-[10px]">LLM Stream</span>
                    <span className="text-emerald-400 font-bold text-sm">{selectedQuery.llm_ms ? `${selectedQuery.llm_ms}ms` : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Evaluation Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-[#121215] border border-white/10 rounded-xl space-y-1">
                  <span className="text-gray-400 font-medium">CRAG Grade:</span>{' '}
                  <span className="text-emerald-400 font-bold uppercase">{selectedQuery.crag_grade || 'Standard RAG'}</span>
                  {selectedQuery.crag_confidence && (
                    <span className="text-gray-400 block text-[11px]">Confidence: {(selectedQuery.crag_confidence * 100).toFixed(0)}%</span>
                  )}
                </div>

                <div className="p-3.5 bg-[#121215] border border-white/10 rounded-xl space-y-1">
                  <span className="text-gray-400 font-medium">Max Retrieval Score:</span>{' '}
                  <span className="text-indigo-400 font-bold font-mono text-xs">
                    {selectedQuery.retrieval_score_max ? selectedQuery.retrieval_score_max.toFixed(4) : 'N/A'}
                  </span>
                  <span className="text-gray-400 block text-[11px]">Candidates: {selectedQuery.candidate_count ?? 0}</span>
                </div>
              </div>

              {/* Retrieved Sources */}
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Retrieved Sources ({selectedQuery.sources?.length ?? 0})</h3>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {selectedQuery.sources?.map((s, idx) => (
                    <div key={idx} className="p-3 bg-[#121215] border border-white/10 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-gray-400 font-mono text-[11px]">
                        <span className="text-emerald-400 font-bold truncate max-w-[200px]">{s.original_name}</span>
                        <span>Score: {s.score?.toFixed(3) ?? 'N/A'}</span>
                      </div>
                      <p className="text-gray-300 font-sans line-clamp-2 text-[11px]">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-white/10 pt-4 mt-6">
              <button
                onClick={() => setSelectedQuery(null)}
                className="w-full py-2.5 bg-[#18181b] hover:bg-[#27272a] text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
