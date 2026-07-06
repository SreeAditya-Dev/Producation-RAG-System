import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, FileType, File, Loader2, CheckCircle2, AlertCircle,
  Trash2,
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
        <FileText size={24} className="mx-auto text-zinc-750 mb-3" />
        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider font-mono">No search results</p>
        <p className="text-zinc-550 text-[10px] mt-1 font-mono uppercase tracking-wide">No records match "{searchQuery}"</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#000000] font-sans select-none">
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
          {filtered.map((doc) => {
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
                  <div className="w-8 h-8 rounded border border-zinc-850 bg-zinc-950 flex items-center justify-center text-zinc-500 shrink-0">
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
  );
}
