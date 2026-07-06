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
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-accent-primary bg-accent-primary/10 scale-[1.01]'
            : state === 'success'
            ? 'border-accent-green/50 bg-accent-green/5'
            : state === 'error'
            ? 'border-accent-red/50 bg-accent-red/5'
            : 'border-border hover:border-accent-primary/60 hover:bg-bg-hover',
          state === 'uploading' && 'pointer-events-none'
        )}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="w-14 h-14 mx-auto rounded-xl bg-bg-card border border-border flex items-center justify-center">
                <Upload size={24} className={isDragActive ? 'text-accent-primary' : 'text-text-muted'} />
              </div>
              <div>
                <p className="text-text-primary font-medium text-sm">
                  {isDragActive ? 'Drop your file here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-text-muted text-xs mt-1">PDF, DOCX, TXT, MD — up to 50MB</p>
              </div>
            </motion.div>
          )}

          {state === 'uploading' && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <Loader2 size={28} className="mx-auto text-accent-primary animate-spin" />
              <div>
                <p className="text-text-primary text-sm font-medium truncate max-w-xs mx-auto">{fileName}</p>
                <p className="text-text-muted text-xs mt-1">Uploading…</p>
              </div>
              <div className="w-full bg-border rounded-full h-1.5">
                <motion.div
                  className="h-1.5 rounded-full bg-accent-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'linear' }}
                />
              </div>
              <p className="text-accent-purple text-xs font-mono">{progress}%</p>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <CheckCircle2 size={28} className="mx-auto text-accent-green" />
              <p className="text-accent-green text-sm font-medium">Upload successful!</p>
              <p className="text-text-muted text-xs">Ingestion pipeline started…</p>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <AlertCircle size={28} className="mx-auto text-accent-red" />
              <p className="text-accent-red text-sm font-medium">Upload failed</p>
              <p className="text-text-muted text-xs">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {fileRejections.length > 0 && (
        <p className="text-accent-red text-xs text-center">
          {fileRejections[0].errors[0].message}
        </p>
      )}
    </div>
  );
}
