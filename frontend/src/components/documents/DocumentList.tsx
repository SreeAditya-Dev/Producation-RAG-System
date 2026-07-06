import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, FileType, File, Loader2, CheckCircle2, AlertCircle,
  Trash2, RefreshCw, Clock,
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
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  docx: FileType,
  txt: File,
  md: File,
};

const STATUS_CONFIG = {
  processing: { icon: Loader2, color: 'text-orange-500', label: 'Processing', spin: true },
  ready: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Ready', spin: false },
  error: { icon: AlertCircle, color: 'text-red-400', label: 'Error', spin: false },
};

interface Props {
  documents: Document[];
  onDeleted: () => void;
  loading?: boolean;
  searchQuery?: string;
}

export function DocumentList({ documents, onDeleted, loading, searchQuery = '' }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);

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
        <Loader2 size={16} className="text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="text-center py-16 border border-zinc-800/80 bg-zinc-900/5 rounded-lg">
        <FileText size={28} className="mx-auto text-zinc-600 mb-3" />
        <p className="text-zinc-400 text-xs font-semibold">No documents yet</p>
        <p className="text-zinc-500 text-[10px] mt-1 font-mono">Upload a document to populate the workspace</p>
      </div>
    );
  }

  // Filter documents client-side based on search term
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
      <div className="text-center py-16 border border-zinc-800/80 bg-zinc-900/5 rounded-lg">
        <FileText size={28} className="mx-auto text-zinc-600 mb-3" />
        <p className="text-zinc-400 text-xs font-semibold">No search results</p>
        <p className="text-zinc-500 text-[10px] mt-1 font-mono">No documents matching "{searchQuery}"</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#0c0c0e]">
      {/* Tabular Header */}
      <div className="hidden md:grid grid-cols-[2.5fr_1fr_100px_100px_130px_40px] items-center gap-4 px-4 py-2.5 border-b border-zinc-800 bg-[#09090b]/60 text-[9px] uppercase tracking-wider text-zinc-500 font-mono">
        <div>Filename</div>
        <div>Status</div>
        <div>Chunks</div>
        <div>Size</div>
        <div>Created</div>
        <div className="text-right">Action</div>
      </div>

      <div className="divide-y divide-zinc-850">
        <AnimatePresence>
          {filtered.map((doc) => {
            const TypeIcon = TYPE_ICONS[doc.file_type] || File;
            const isDeleting = deleting === doc.id;

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-[2.5fr_1fr_100px_100px_130px_40px] items-center gap-4 p-4 md:px-4 md:py-3 hover:bg-zinc-900/20 transition-all duration-200 group text-xs text-zinc-300"
              >
                {/* File name & details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-400 shrink-0">
                    <TypeIcon size={14} className="text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-200 truncate pr-2" title={doc.original_name}>
                      {doc.original_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 md:hidden">
                      <span className="font-mono text-[9px] text-zinc-500 uppercase">{doc.file_type}</span>
                      <span className="text-zinc-700">&middot;</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{formatBytes(doc.file_size)}</span>
                      {doc.status !== 'ready' && (
                        <>
                          <span className="text-zinc-700">&middot;</span>
                          <span
                            className={clsx(
                              'text-[9px] font-mono uppercase',
                              doc.status === 'processing' ? 'text-amber-400' : 'text-red-400'
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
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider',
                      doc.status === 'ready'
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                        : doc.status === 'processing'
                        ? 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                        : 'border-red-500/20 bg-red-500/5 text-red-400'
                    )}
                  >
                    <span
                      className={clsx(
                        'h-1 w-1 rounded-full',
                        doc.status === 'ready'
                          ? 'bg-emerald-400'
                          : doc.status === 'processing'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-red-400'
                      )}
                    />
                    {doc.status}
                  </span>
                </div>

                {/* Chunks */}
                <div className="hidden md:block font-mono text-[11px] text-zinc-400">
                  {doc.status === 'ready' ? doc.chunk_count : '—'}
                </div>

                {/* Size */}
                <div className="hidden md:block font-mono text-[11px] text-zinc-400">
                  {formatBytes(doc.file_size)}
                </div>

                {/* Date */}
                <div className="hidden md:block font-mono text-[10px] text-zinc-500">
                  {formatDate(doc.created_at)}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 text-right">
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={isDeleting || doc.status === 'processing'}
                    className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-zinc-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    title="Delete document"
                  >
                    {isDeleting ? (
                      <Loader2 size={13} className="animate-spin" />
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
  );
}
