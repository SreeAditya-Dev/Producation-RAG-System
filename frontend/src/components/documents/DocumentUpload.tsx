import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { documentsApi } from '../../services/api';
import toast from 'react-hot-toast';

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/markdown': ['.md'],
};

interface Props {
  onUploaded: () => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function DocumentUpload({ onUploaded }: Props) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      const file = accepted[0];
      setFileName(file.name);
      setState('uploading');
      setProgress(0);
      setError('');

      try {
        await documentsApi.upload(file, setProgress);
        setState('success');
        toast.success(`"${file.name}" uploaded — ingestion started`);
        onUploaded();
        setTimeout(() => setState('idle'), 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setState('error');
        setError(msg);
        toast.error(msg);
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: state === 'uploading',
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={clsx(
          'relative border border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-zinc-400 bg-zinc-900/30 scale-[1.005]'
            : state === 'success'
            ? 'border-zinc-800 bg-zinc-900/10'
            : state === 'error'
            ? 'border-zinc-800 bg-zinc-900/10'
            : 'border-zinc-800 hover:border-zinc-700 hover:bg-[#0c0c0e]',
          state === 'uploading' && 'pointer-events-none'
        )}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="space-y-3"
            >
              <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                <Upload size={16} className={isDragActive ? 'text-zinc-200' : 'text-zinc-500'} />
              </div>
              <div>
                <p className="text-zinc-200 font-medium text-xs">
                  {isDragActive ? 'Drop to upload' : 'Click or drag file here to upload'}
                </p>
                <p className="text-zinc-500 text-[10px] mt-1 font-mono">
                  PDF, DOCX, TXT, MD &middot; Max 50MB
                </p>
              </div>
            </motion.div>
          )}

          {state === 'uploading' && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 py-2"
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span className="truncate max-w-[200px] text-left">{fileName}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-zinc-900 border border-zinc-800/80 rounded-full h-1 overflow-hidden">
                <motion.div
                  className="h-full bg-zinc-300"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'linear' }}
                />
              </div>
              <p className="text-zinc-500 text-[10px] font-mono text-left">Uploading payload to engine...</p>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 py-3"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Upload Complete
              </div>
              <p className="text-zinc-400 text-xs">Ingesting document chunks into pipeline</p>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 py-3"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-2.5 py-0.5 text-[10px] font-mono text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Upload Failed
              </div>
              <p className="text-zinc-500 text-[10px] font-mono max-w-xs mx-auto truncate">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {fileRejections.length > 0 && (
        <p className="text-red-400 text-[10px] font-mono text-center">
          {fileRejections[0].errors[0].message}
        </p>
      )}
    </div>
  );
}
