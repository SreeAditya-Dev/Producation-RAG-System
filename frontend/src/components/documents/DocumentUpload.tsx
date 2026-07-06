import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
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
    <div className="space-y-3 font-sans select-none">
      <div
        {...getRootProps()}
        className={clsx(
          'relative border border-dashed rounded-md p-6 text-center cursor-pointer transition-all duration-200 bg-[#000000]',
          isDragActive
            ? 'border-[#F4831F] bg-[#F4831F]/5 scale-[1.002]'
            : state === 'success'
            ? 'border-zinc-800 bg-[#09090b]/40'
            : state === 'error'
            ? 'border-zinc-800 bg-[#09090b]/40'
            : 'border-zinc-800 hover:border-[#F4831F]/50 hover:bg-[#09090b]/20',
          state === 'uploading' && 'pointer-events-none'
        )}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              className="space-y-3.5"
            >
              <div className="w-9 h-9 mx-auto rounded bg-zinc-950 border border-zinc-900 flex items-center justify-center text-[#F4831F]">
                <Upload size={14} className={isDragActive ? 'text-[#F4831F]' : 'text-[#F4831F]/90'} />
              </div>
              <div>
                <p className="text-zinc-200 font-semibold text-xs">
                  {isDragActive ? 'Drop payload to transmit' : 'Click or drag files here to upload'}
                </p>
                <p className="text-zinc-550 text-[9px] mt-1 font-mono uppercase tracking-wider">
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
              <div className="flex items-center justify-between text-[9px] text-zinc-400 font-mono">
                <span className="truncate max-w-[200px] text-left">{fileName}</span>
                <span className="font-semibold text-zinc-250">{progress}%</span>
              </div>
              <div className="w-full bg-zinc-900 border border-zinc-800 rounded h-1 overflow-hidden">
                <motion.div
                  className="h-full bg-[#F4831F]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'linear' }}
                />
              </div>
              <p className="text-zinc-500 text-[9px] font-mono text-left uppercase tracking-wider">Uploading payload to engine...</p>
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
              <div className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/30 px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-zinc-350">
                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                Ingress Ready
              </div>
              <p className="text-zinc-500 text-[10px] font-mono leading-relaxed max-w-[240px] mx-auto uppercase tracking-wider">
                Payload uploaded successfully. Ingesting chunks...
              </p>
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
              <div className="inline-flex items-center gap-1.5 rounded border border-red-950 bg-red-950/20 px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-red-405">
                <span className="h-1 w-1 rounded-full bg-red-500" />
                Ingress Failed
              </div>
              <p className="text-zinc-500 text-[9px] font-mono max-w-xs mx-auto truncate uppercase tracking-wider">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {fileRejections.length > 0 && (
        <p className="text-red-400 text-[9px] font-mono text-center uppercase tracking-wider">
          {fileRejections[0].errors[0].message}
        </p>
      )}
    </div>
  );
}
