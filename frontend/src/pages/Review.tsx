import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Copy,
  PencilLine,
  RefreshCw,
  Search,
  ShieldAlert,
  ThumbsDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { feedbackApi } from '../services/api';
import { FEEDBACK_REASON_LABELS } from '../types';
import type { FeedbackReviewCandidate } from '../types';

type Filter = 'all' | 'down' | 'corrected';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'down', label: 'Down-rated' },
  { value: 'corrected', label: 'Has correction' },
];

export function Review() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['feedbackReviewCandidates'],
    queryFn: () => feedbackApi.reviewCandidates(200).then((r) => r.data),
    refetchInterval: 30000,
  });

  const candidates = data?.candidates ?? [];
  const downCount = candidates.filter((c) => c.rating === 'down').length;
  const correctedCount = candidates.filter((c) => c.correction).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (filter === 'down' && candidate.rating !== 'down') return false;
      if (filter === 'corrected' && !candidate.correction) return false;
      if (!term) return true;
      return [candidate.question, candidate.answer, candidate.correction]
        .some((field) => (field ?? '').toLowerCase().includes(term));
    });
  }, [candidates, filter, search]);

  // Approved cases are committed to the versioned fixture by hand, so the only
  // action this page offers is lifting one out in the fixture's shape.
  const copyCase = async (candidate: FeedbackReviewCandidate) => {
    const payload = {
      query_id: candidate.query_id,
      question: candidate.question,
      expected_answer: candidate.correction,
      observed_answer: candidate.answer,
      rating: candidate.rating,
      reason: candidate.reason,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success('Case copied as JSON');
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  return (
    <div className="mx-auto h-full w-full max-w-[1600px] px-6 py-6 font-sans text-zinc-300">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-zinc-900 pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-widest text-white">
              <ClipboardCheck size={13} className="text-[#F4831F]" />
              Feedback Review
            </h1>
            <p className="mt-1 font-mono text-xs text-zinc-500">
              Down-rated and corrected answers, newest first — candidate benchmark cases.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex items-center rounded border border-zinc-800 bg-zinc-950 transition-colors focus-within:border-[#F4831F]/50">
              <span className="absolute left-2.5 text-zinc-600">
                <Search size={12} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions, answers, corrections..."
                className="w-64 bg-transparent py-1.5 pl-8 pr-3 font-mono text-[11px] text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>
            <button
              onClick={() => refetch()}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-zinc-800 bg-black px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition-all hover:bg-zinc-900/60 hover:text-white"
              title="Refresh review queue"
            >
              <RefreshCw size={12} className={clsx(isFetching && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Read-only notice — mirrors the endpoint's requires_human_approval contract */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="font-mono text-[10px] leading-relaxed text-zinc-400">
            <span className="font-bold text-amber-400">Human approval required.</span>{' '}
            This queue is read-only. Nothing here reaches the index, the benchmark fixture, or
            retrieval — copy an approved case and commit it to the versioned fixture yourself.
          </p>
        </div>

        {/* Counters + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={clsx(
                  'rounded border px-2.5 py-1 font-mono text-[10px] transition-colors',
                  filter === option.value
                    ? 'border-[#F4831F]/50 bg-[#F4831F]/10 text-[#F4831F]'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px] text-zinc-500">
            <span>
              <span className="font-bold text-white">{candidates.length}</span> candidates
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown size={10} className="text-red-400" />
              <span className="font-bold text-white">{downCount}</span> down-rated
            </span>
            <span className="flex items-center gap-1">
              <PencilLine size={10} className="text-sky-400" />
              <span className="font-bold text-white">{correctedCount}</span> corrected
            </span>
          </div>
        </div>

        {/* Queue */}
        {isLoading ? (
          <div className="py-16 text-center font-mono text-xs text-zinc-600">Loading review queue...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 py-16 text-center font-mono text-xs text-zinc-600">
            {candidates.length === 0
              ? 'No review candidates yet — down-rated answers and corrections land here.'
              : 'No candidates match this filter.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((candidate) => {
              const isOpen = expanded[candidate.query_id];
              return (
                <div
                  key={candidate.query_id}
                  className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 transition-colors hover:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        {candidate.rating === 'down' && (
                          <span className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[9px] text-red-300">
                            <ThumbsDown size={9} />
                            down
                          </span>
                        )}
                        {candidate.reason && (
                          <span className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
                            {FEEDBACK_REASON_LABELS[candidate.reason] ?? candidate.reason}
                          </span>
                        )}
                        {candidate.correction && (
                          <span className="flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] text-sky-300">
                            <PencilLine size={9} />
                            correction
                          </span>
                        )}
                        <span className="font-mono text-[9px] text-zinc-700">{candidate.query_id.slice(0, 8)}</span>
                      </div>
                      <p className="break-words text-xs font-semibold leading-relaxed text-zinc-100">
                        {candidate.question}
                      </p>
                    </div>

                    <button
                      onClick={() => copyCase(candidate)}
                      title="Copy as benchmark case JSON"
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-zinc-800 bg-black px-2.5 py-1 font-mono text-[10px] text-zinc-400 transition-all hover:bg-zinc-900/60 hover:text-white"
                    >
                      <Copy size={11} />
                      Copy JSON
                    </button>
                  </div>

                  {candidate.correction && (
                    <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/[0.03] p-3">
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-sky-400">
                        Reviewer correction
                      </p>
                      <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                        {candidate.correction}
                      </p>
                    </div>
                  )}

                  <div className="mt-3">
                    <button
                      onClick={() =>
                        setExpanded((current) => ({ ...current, [candidate.query_id]: !isOpen }))
                      }
                      className="font-mono text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                      {isOpen ? '− Hide' : '+ Show'} answer given
                    </button>
                    {isOpen && (
                      <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-900 bg-black p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                        {candidate.answer || '(no answer recorded)'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
