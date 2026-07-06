import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, FileType, File, Loader2, CheckCircle2, AlertCircle,
  Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { documentsApi } from '../../services/api';
import type { Document } from '../../types';
import toast from 'react-hot-toast';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  docx: FileType,
  txt: File,
  md: File,
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface Props {
  documents: Document[];
  onDeleted: () => void;
  loading?: boolean;
  searchQuery?: string;
}

export function DocumentList({ documents, onDeleted, loading, searchQuery = '' }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when search or data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, documents.length]);

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.original_name}"? This will remove all its vectors from Pinecone.`)) return;
    setDeleting(doc.id);
    try {
      await documentsApi.delete(doc.id);
      toast.success(`"${doc.original_name}" deleted`);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={14} className="text-[#F4831F] animate-spin" />
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="text-center py-16 border border-zinc-800 bg-[#000000] rounded-lg select-none font-sans">
        <FileText size={24} className="mx-auto text-zinc-700 mb-3" />
        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider font-mono">No documents found</p>
        <p className="text-zinc-550 text-[10px] mt-1 font-mono uppercase tracking-wide">Upload a payload to populate inventory</p>
      </div>
    );
  }

  const filtered = documents.filter((doc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      doc.original_name.toLowerCase().includes(q) ||
      doc.file_type.toLowerCase().includes(q)
    );
  });

  if (!filtered.length) {
    return (
      <div className="text-center py-16 border border-zinc-800 bg-[#000000] rounded-lg select-none font-sans">
        <FileText size={24} className="mx-auto text-zinc-700 mb-3" />
        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider font-mono">No search results</p>
        <p className="text-zinc-550 text-[10px] mt-1 font-mono uppercase tracking-wide">No records match "{searchQuery}"</p>
      </div>
    );
  }

  const totalPages = Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paged = filtered.slice(startIdx, startIdx + pageSize);

  return (
    <div className="space-y-0">
      <div className="overflow-hidden rounded-t-lg border border-zinc-800 bg-[#000000] font-sans select-none">
        {/* Tabular Header */}
        <div className="hidden md:grid grid-cols-[2.5fr_1fr_100px_100px_130px_40px] items-center gap-4 px-4 py-2.5 border-b border-zinc-800 bg-[#09090b] text-[9px] uppercase tracking-widest text-zinc-450 font-mono font-semibold">
          <div>Filename</div>
          <div>Status</div>
          <div>Chunks</div>
          <div>Size</div>
          <div>Created</div>
          <div className="text-right">Action</div>
        </div>

        <div className="divide-y divide-zinc-900 bg-black">
          <AnimatePresence>
            {paged.map((doc) => {
              const TypeIcon = TYPE_ICONS[doc.file_type] || File;
              const isDeleting = deleting === doc.id;

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-[2.5fr_1fr_100px_100px_130px_40px] items-center gap-4 p-4 md:px-4 md:py-3 hover:bg-zinc-950/60 transition-colors duration-200 group text-xs text-zinc-300 border-zinc-900"
                >
                  {/* File name & details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-500 shrink-0">
                      <TypeIcon size={13} className="text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-200 truncate pr-2 font-mono" title={doc.original_name}>
                        {doc.original_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 md:hidden">
                        <span className="font-mono text-[9px] text-[#F4831F] font-bold uppercase">{doc.file_type}</span>
                        <span className="text-zinc-800">&middot;</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{formatBytes(doc.file_size)}</span>
                        {doc.status !== 'ready' && (
                          <>
                            <span className="text-zinc-800">&middot;</span>
                            <span
                              className={clsx(
                                'text-[9px] font-mono uppercase font-bold',
                                doc.status === 'processing' ? 'text-[#F4831F]' : 'text-red-405'
                              )}
                            >
                              {doc.status}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="hidden md:block">
                    {doc.status === 'processing' && (
                      <span className="inline-flex items-center gap-1.5 rounded border border-[#F4831F]/30 bg-[#F4831F]/5 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#F4831F] font-bold">
                        <Loader2 size={10} className="animate-spin text-[#F4831F]" />
                        Processing
                      </span>
                    )}
                    {doc.status === 'ready' && (
                      <span className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" />
                        Ready
                      </span>
                    )}
                    {doc.status === 'error' && (
                      <span className="inline-flex items-center gap-1.5 rounded border border-red-950 bg-red-950/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-red-405">
                        <AlertCircle size={10} className="text-red-405" />
                        Error
                      </span>
                    )}
                  </div>

                  {/* Chunks */}
                  <div className="hidden md:block font-mono text-[10px] text-zinc-400 font-semibold">
                    {doc.status === 'ready' ? (
                      <span className="text-zinc-300">{doc.chunk_count}</span>
                    ) : doc.status === 'processing' ? (
                      <Loader2 size={10} className="animate-spin text-[#F4831F]" />
                    ) : (
                      <span className="text-zinc-600">&mdash;</span>
                    )}
                  </div>

                  {/* Size */}
                  <div className="hidden md:block font-mono text-[10px] text-zinc-400">
                    {formatBytes(doc.file_size)}
                  </div>

                  {/* Date */}
                  <div className="hidden md:block font-mono text-[10px] text-zinc-550">
                    {formatDate(doc.created_at)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 text-right">
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={isDeleting || doc.status === 'processing'}
                      className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-950/20 hover:text-red-405 text-zinc-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                      title="Delete document"
                    >
                      {isDeleting ? (
                        <Loader2 size={13} className="animate-spin text-[#F4831F]" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Pagination Controls ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-b-lg border border-t-0 border-zinc-800 bg-[#09090b]">
        {/* Left: Page size selector & info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-[#F4831F]/50 cursor-pointer appearance-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <span className="text-[10px] font-mono text-zinc-600">
            {startIdx + 1}–{Math.min(startIdx + pageSize, filtered.length)} of {filtered.length}
          </span>
        </div>

        {/* Right: Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="First page"
          >
            <ChevronsLeft size={12} />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="p-1.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Previous page"
          >
            <ChevronLeft size={12} />
          </button>

          {/* Page number pills */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (totalPages <= 7) return true;
              if (p === 1 || p === totalPages) return true;
              if (Math.abs(p - safePage) <= 1) return true;
              return false;
            })
            .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`e-${idx}`} className="px-1 text-[10px] text-zinc-600 font-mono">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item as number)}
                  className={clsx(
                    "min-w-[28px] h-7 rounded border text-[10px] font-mono font-semibold transition-all cursor-pointer",
                    safePage === item
                      ? "border-[#F4831F]/40 bg-[#F4831F]/10 text-[#F4831F]"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700"
                  )}
                >
                  {item}
                </button>
              )
            )}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Next page"
          >
            <ChevronRight size={12} />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Last page"
          >
            <ChevronsRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
