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
  processing: { icon: Loader2, color: 'text-accent-orange', label: 'Processing', spin: true },
  ready: { icon: CheckCircle2, color: 'text-accent-green', label: 'Ready', spin: false },
  error: { icon: AlertCircle, color: 'text-accent-red', label: 'Error', spin: false },
};

interface Props {
  documents: Document[];
  onDeleted: () => void;
  loading?: boolean;
}

export function DocumentList({ documents, onDeleted, loading }: Props) {
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
        <Loader2 size={24} className="text-accent-primary animate-spin" />
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="text-center py-16">
        <FileText size={40} className="mx-auto text-text-muted opacity-40 mb-3" />
        <p className="text-text-secondary text-sm">No documents yet</p>
        <p className="text-text-muted text-xs mt-1">Upload a document to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {documents.map((doc) => {
          const TypeIcon = TYPE_ICONS[doc.file_type] || File;
          const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.error;
          const StatusIcon = status.icon;
          const isDeleting = deleting === doc.id;

          return (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-4 p-3.5 bg-bg-card border border-border rounded-xl hover:border-border-light transition-colors group"
            >
              {/* File type icon */}
              <div className="w-9 h-9 rounded-lg bg-bg-hover border border-border flex items-center justify-center flex-shrink-0">
                <TypeIcon size={17} className="text-accent-primary" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm font-medium truncate">{doc.original_name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-text-muted text-xs uppercase tracking-wide">{doc.file_type}</span>
                  <span className="text-text-muted text-xs">·</span>
                  <span className="text-text-muted text-xs">{formatBytes(doc.file_size)}</span>
                  {doc.status === 'ready' && (
                    <>
                      <span className="text-text-muted text-xs">·</span>
                      <span className="text-text-muted text-xs">{doc.chunk_count} chunks</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className={clsx('flex items-center gap-1.5 text-xs font-medium', status.color)}>
                <StatusIcon size={14} className={status.spin ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{status.label}</span>
              </div>

              {/* Date */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-text-muted">
                <Clock size={12} />
                {formatDate(doc.created_at)}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(doc)}
                disabled={isDeleting || doc.status === 'processing'}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-accent-red/10 hover:text-accent-red text-text-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
