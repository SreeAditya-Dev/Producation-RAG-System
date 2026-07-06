import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Radio, ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import type { EventLogEntry } from '../../types';

interface Props {
  entries: EventLogEntry[];
  onClear: () => void;
  connected: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const TYPE_STYLES = {
  info: 'text-zinc-500',
  success: 'text-zinc-300',
  error: 'text-red-400',
  warning: 'text-zinc-400',
};

const TYPE_DOT = {
  info: 'bg-zinc-800 border border-zinc-700',
  success: 'bg-zinc-400',
  error: 'bg-red-500',
  warning: 'bg-zinc-600',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

export function EventLog({ entries, onClear, connected, collapsed = false, onToggleCollapse }: Props) {
  return (
    <div className="bg-[#0c0c0e] flex flex-col h-full select-none">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80 shrink-0 h-[40px] bg-[#0c0c0e]">
        <div className="flex items-center gap-2">
          <Radio size={12} className={clsx(connected ? 'text-emerald-400' : 'text-zinc-650')} />
          <span className="text-zinc-450 text-[10px] font-mono uppercase tracking-wider">Live Event Stream</span>
          {entries.length > 0 && (
            <span className="text-[9px] text-zinc-405 bg-zinc-950 border border-zinc-850 px-1 py-0.2 rounded font-mono">
              {entries.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {entries.length > 0 && !collapsed && (
            <button
              onClick={onClear}
              className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Clear stream logs"
            >
              <Trash2 size={12} />
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-zinc-350 transition-colors"
              title={collapsed ? 'Expand logs panel' : 'Collapse logs panel'}
            >
              {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Logs Feed */}
      <div className={clsx(
        "flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[9px] text-zinc-550 transition-all duration-300",
        collapsed && "hidden"
      )}>
        {entries.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-600 py-6">
            <div className="text-center font-mono">
              <Radio size={16} className="mx-auto mb-1 opacity-20" />
              <p>Awaiting engine pipeline events...</p>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {!collapsed && entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2 py-0.5"
            >
              <span className="text-zinc-650 flex-shrink-0 mt-0.5">{formatTime(entry.timestamp)}</span>
              <div className={clsx('w-1 h-1 rounded-full mt-1.5 flex-shrink-0', TYPE_DOT[entry.type])} />
              <span className={clsx('flex-1 break-all leading-normal', TYPE_STYLES[entry.type])}>
                {entry.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
