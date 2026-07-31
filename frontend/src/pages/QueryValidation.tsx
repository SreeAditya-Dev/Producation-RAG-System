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
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
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

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="h-7 w-7 text-emerald-400" />
            Query Validation & Observability Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Monitor per-query latency, retrieval confidence scores, CRAG evaluation grades, and citation validity metrics.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg border border-gray-700 text-sm font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Queries */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Queries</span>
            <Database className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">{summary?.total_queries ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Logged pipeline runs</p>
        </div>

        {/* Avg Latency */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Avg Latency</span>
            <Clock className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">
            {summary?.avg_total_ms ? `${(summary.avg_total_ms / 1000).toFixed(2)}s` : '0.00s'}
          </p>
          <p className="text-xs text-gray-400 mt-1">End-to-end processing time</p>
        </div>

        {/* CRAG Evaluation */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">CRAG Grades</span>
            <Layers className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm font-semibold text-emerald-400">{summary?.crag_grades?.correct ?? 0} Correct</span>
            <span className="text-sm font-semibold text-amber-400">{summary?.crag_grades?.ambiguous ?? 0} Ambig</span>
            <span className="text-sm font-semibold text-red-400">{summary?.crag_grades?.incorrect ?? 0} Incorr</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Corrective RAG Evaluation</p>
        </div>

        {/* Citation Validity */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Citation Validity</span>
            <FileCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">{summary?.citation_valid_pct ?? 100}%</p>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            <span className="flex items-center gap-1 text-emerald-400"><ThumbsUp className="h-3 w-3" /> {summary?.positive_feedback ?? 0}</span>
            <span className="flex items-center gap-1 text-red-400"><ThumbsDown className="h-3 w-3" /> {summary?.negative_feedback ?? 0}</span>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Controls ─────────────────────────────────────────── */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-4 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search question or answer text..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-950 border border-gray-800 px-2.5 py-1.5 rounded-lg text-xs text-gray-300">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-gray-900">Status: All</option>
                <option value="success" className="bg-gray-900">Success</option>
                <option value="error" className="bg-gray-900">Error</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-950 border border-gray-800 px-2.5 py-1.5 rounded-lg text-xs text-gray-300">
              <select
                value={cragFilter}
                onChange={(e) => { setCragFilter(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-gray-900">CRAG: All</option>
                <option value="correct" className="bg-gray-900">Correct</option>
                <option value="ambiguous" className="bg-gray-900">Ambiguous</option>
                <option value="incorrect" className="bg-gray-900">Incorrect</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-950 border border-gray-800 px-2.5 py-1.5 rounded-lg text-xs text-gray-300">
              <select
                value={feedbackFilter}
                onChange={(e) => { setFeedbackFilter(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-gray-900">Feedback: All</option>
                <option value="up" className="bg-gray-900">Thumbs Up</option>
                <option value="down" className="bg-gray-900">Thumbs Down</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-950 border border-gray-800 px-2.5 py-1.5 rounded-lg text-xs text-gray-300">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-transparent border-none text-gray-200 focus:outline-none cursor-pointer font-bold"
              >
                <option value={10} className="bg-gray-900">10</option>
                <option value={20} className="bg-gray-900">20</option>
                <option value={50} className="bg-gray-900">50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Query Validation Table ───────────────────────────────────────────── */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-xl shadow-xl overflow-hidden backdrop-blur">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
            <p className="text-sm font-medium">Loading query telemetry metrics...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center px-4">
            <ShieldAlert className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-base font-semibold text-gray-300">No Query Metrics Found</p>
            <p className="text-xs text-gray-500 max-w-sm mt-1">
              No logged query executions matched your selected filters or search parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/80 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Query ID</th>
                  <th className="py-3.5 px-4 font-semibold">Question</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Latency</th>
                  <th className="py-3.5 px-4 font-semibold">CRAG Grade</th>
                  <th className="py-3.5 px-4 font-semibold">Max Score</th>
                  <th className="py-3.5 px-4 font-semibold">Citations</th>
                  <th className="py-3.5 px-4 font-semibold">Feedback</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-mono text-xs">
                {items.map((item) => {
                  const latencySec = item.total_ms ? (item.total_ms / 1000).toFixed(2) : (item.processing_time || 0).toFixed(2);
                  const isSuccess = item.status === 'success';

                  return (
                    <tr key={item.query_id} className="hover:bg-gray-800/40 transition">
                      {/* ID */}
                      <td className="py-3.5 px-4 text-emerald-400 font-semibold truncate max-w-[100px]">
                        {item.query_id.substring(0, 8)}...
                      </td>

                      {/* Question */}
                      <td className="py-3.5 px-4 font-sans text-gray-200 font-medium truncate max-w-[280px]">
                        {item.question}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
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
                      <td className="py-3.5 px-4 text-gray-300 font-medium">
                        {latencySec}s
                      </td>

                      {/* CRAG Grade */}
                      <td className="py-3.5 px-4">
                        {item.crag_grade ? (
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border',
                              item.crag_grade === 'correct' && 'bg-emerald-950 text-emerald-400 border-emerald-800',
                              item.crag_grade === 'ambiguous' && 'bg-amber-950 text-amber-400 border-amber-800',
                              item.crag_grade === 'incorrect' && 'bg-red-950 text-red-400 border-red-800'
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
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Valid ({item.citation_cited_source_count ?? 0})
                            </span>
                          ) : (
                            <span className="text-red-400 font-semibold flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Invalid
                            </span>
                          )
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>

                      {/* Feedback */}
                      <td className="py-3.5 px-4">
                        {item.feedback_rating === 'up' && (
                          <span className="text-emerald-400 flex items-center gap-1 font-sans text-xs">
                            <ThumbsUp className="h-3.5 w-3.5" /> Like
                          </span>
                        )}
                        {item.feedback_rating === 'down' && (
                          <span className="text-red-400 flex items-center gap-1 font-sans text-xs font-semibold">
                            <ThumbsDown className="h-3.5 w-3.5" /> Dislike
                          </span>
                        )}
                        {!item.feedback_rating && <span className="text-gray-600">—</span>}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedQuery(item)}
                          className="p-1.5 bg-gray-800 hover:bg-emerald-600 hover:text-white text-gray-300 rounded-md transition shadow-sm"
                          title="Inspect Query Telemetry"
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

        {/* ── Pagination Controls ───────────────────────────────────────────────── */}
        <div className="bg-gray-950/90 border-t border-gray-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
          <div>
            Showing <span className="font-semibold text-gray-200">{items.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
            <span className="font-semibold text-gray-200">{Math.min(page * limit, totalItems)}</span> of{' '}
            <span className="font-semibold text-gray-200">{totalItems}</span> queries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 border border-gray-800 text-gray-300 hover:bg-gray-800 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed font-sans text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>

            <span className="px-2 font-medium text-gray-300 font-sans">
              Page <span className="text-emerald-400 font-bold">{page}</span> of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 border border-gray-800 text-gray-300 hover:bg-gray-800 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed font-sans text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Query Diagnostics Drawer / Modal ─────────────────────────────────── */}
      {selectedQuery && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end p-0 transition-opacity">
          <div className="w-full max-w-2xl bg-gray-900 border-l border-gray-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-gray-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-400" />
                    Query Diagnostic Inspector
                  </h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {selectedQuery.query_id}</p>
                </div>
                <button
                  onClick={() => setSelectedQuery(null)}
                  className="p-1 text-gray-400 hover:text-white bg-gray-800 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {/* Question & Answer */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">User Question</h3>
                  <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-100 font-medium">
                    {selectedQuery.question}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Generated Answer</h3>
                  <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-300 space-y-2 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {selectedQuery.answer || <span className="text-gray-500 italic">No answer content recorded.</span>}
                  </div>
                </div>
              </div>

              {/* Latency Stage Breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Stage Latency Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="p-2.5 bg-gray-950 border border-gray-800 rounded-lg">
                    <span className="text-gray-400 block text-[10px]">Embedding</span>
                    <span className="text-blue-400 font-bold">{selectedQuery.embed_ms ? `${selectedQuery.embed_ms}ms` : '—'}</span>
                  </div>
                  <div className="p-2.5 bg-gray-950 border border-gray-800 rounded-lg">
                    <span className="text-gray-400 block text-[10px]">Retrieval</span>
                    <span className="text-indigo-400 font-bold">{selectedQuery.retrieve_ms ? `${selectedQuery.retrieve_ms}ms` : '—'}</span>
                  </div>
                  <div className="p-2.5 bg-gray-950 border border-gray-800 rounded-lg">
                    <span className="text-gray-400 block text-[10px]">Reranking</span>
                    <span className="text-amber-400 font-bold">{selectedQuery.rerank_ms ? `${selectedQuery.rerank_ms}ms` : '—'}</span>
                  </div>
                  <div className="p-2.5 bg-gray-950 border border-gray-800 rounded-lg">
                    <span className="text-gray-400 block text-[10px]">LLM Stream</span>
                    <span className="text-emerald-400 font-bold">{selectedQuery.llm_ms ? `${selectedQuery.llm_ms}ms` : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Evaluation Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-gray-950 border border-gray-800 rounded-lg space-y-1">
                  <span className="text-gray-400 font-medium">CRAG Grade:</span>{' '}
                  <span className="text-emerald-400 font-bold uppercase">{selectedQuery.crag_grade || 'Standard RAG'}</span>
                  {selectedQuery.crag_confidence && (
                    <span className="text-gray-400 block">Confidence: {(selectedQuery.crag_confidence * 100).toFixed(0)}%</span>
                  )}
                </div>

                <div className="p-3 bg-gray-950 border border-gray-800 rounded-lg space-y-1">
                  <span className="text-gray-400 font-medium">Max Retrieval Score:</span>{' '}
                  <span className="text-indigo-400 font-bold font-mono">
                    {selectedQuery.retrieval_score_max ? selectedQuery.retrieval_score_max.toFixed(4) : 'N/A'}
                  </span>
                  <span className="text-gray-400 block">Candidates: {selectedQuery.candidate_count ?? 0}</span>
                </div>
              </div>

              {/* Retrieved Sources */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Retrieved Sources ({selectedQuery.sources?.length ?? 0})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedQuery.sources?.map((s, idx) => (
                    <div key={idx} className="p-2.5 bg-gray-950 border border-gray-800 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between text-gray-400 font-mono">
                        <span className="text-emerald-400 font-semibold">{s.original_name}</span>
                        <span>Score: {s.score?.toFixed(3) ?? 'N/A'}</span>
                      </div>
                      <p className="text-gray-300 font-sans line-clamp-2">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-800 pt-4 mt-6">
              <button
                onClick={() => setSelectedQuery(null)}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition"
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
