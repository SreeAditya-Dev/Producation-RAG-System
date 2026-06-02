import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import type { EventLogEntry } from '../../types';

interface Props {
  entries: EventLogEntry[];
  onClear: () => void;
  connected: boolean;
}

const TYPE_STYLES = {
  info: 'text-text-secondary',
  success: 'text-accent-green',
  error: 'text-accent-red',
  warning: 'text-accent-orange',
};

const TYPE_DOT = {
  info: 'bg-text-muted',
  success: 'bg-accent-green',
  error: 'bg-accent-red',
  warning: 'bg-accent-orange',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

export function EventLog({ entries, onClear, connected }: Props) {
  return (
    <div className="bg-bg-card border border-border rounded-2xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Radio size={14} className={connected ? 'text-accent-green' : 'text-text-muted'} />
          <span className="text-text-primary text-sm font-medium">Live Event Stream</span>
          {entries.length > 0 && (
            <span className="text-xs text-text-muted bg-bg-hover px-1.5 py-0.5 rounded">
              {entries.length}
            </span>
          )}
        </div>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Log */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-xs">
        {entries.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted py-8">
            <div className="text-center">
              <Radio size={20} className="mx-auto mb-2 opacity-30" />
              <p>Waiting for events…</p>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2 py-1"
            >
              <span className="text-text-muted flex-shrink-0 mt-0.5">{formatTime(entry.timestamp)}</span>
              <div className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', TYPE_DOT[entry.type])} />
              <span className={clsx('flex-1 break-all', TYPE_STYLES[entry.type])}>
                {entry.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
