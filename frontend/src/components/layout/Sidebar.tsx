import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Activity,
  Cpu,
  Wifi,
  WifiOff,
  ChevronRight,
  Layers3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', color: '#a855f7' },
  { to: '/documents', icon: FileText, label: 'Documents', color: '#06b6d4' },
  { to: '/query', icon: MessageSquare, label: 'Query', color: '#10b981' },
  { to: '/visualizer', icon: Activity, label: 'Live Pipeline', color: '#f59e0b' },
];

interface SidebarProps {
  connected: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ connected, mobile = false, onNavigate }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-bg-secondary',
        mobile ? 'w-[292px] shadow-2xl' : 'w-72'
      )}
    >
      <div className="pointer-events-none absolute left-0 top-0 h-32 w-32 rounded-full bg-accent-purple/8 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 right-0 h-24 w-24 rounded-full bg-accent-cyan/6 blur-2xl" />

      <div className="relative border-b border-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            <svg className="absolute inset-0 h-full w-full ring-rotate" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="url(#logo-ring)" strokeWidth="1.5" strokeDasharray="8 4" />
              <defs>
                <linearGradient id="logo-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan shadow-neon-purple">
              <span className="text-xs font-bold text-white">R</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-wide text-text-primary">RAG System</div>
            <div className="mt-0.5 truncate text-xs text-text-muted">NVIDIA NIM + Pinecone</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-gradient-to-br from-white/[0.05] to-transparent p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
            <Layers3 size={13} className="text-accent-cyan" />
            Multi-layer retrieval workflow
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Upload, parse, chunk, embed, retrieve, and answer inside one responsive control surface.
          </p>
        </div>
      </div>

      <nav className="relative flex-1 space-y-1 px-3 py-4">
        {links.map(({ to, icon: Icon, label, color }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive ? 'text-white' : 'text-text-secondary hover:bg-white/3 hover:text-text-primary'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${color}20, ${color}10)`,
                      borderLeft: `2px solid ${color}`,
                    }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl" style={{ boxShadow: `inset 0 0 20px ${color}12` }} />
                )}
                <div className="relative flex w-full items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
                    style={isActive ? { background: `${color}25` } : {}}
                  >
                    <Icon size={16} style={isActive ? { color } : {}} />
                  </div>
                  <span>{label}</span>
                  {isActive && <ChevronRight size={13} className="ml-auto opacity-50" style={{ color }} />}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="space-y-3 px-4 py-4">
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wider text-text-muted">Stack</p>
          {[
            { icon: Cpu, label: 'Llama-3.3-70B', color: '#a855f7' },
            { icon: Activity, label: 'nv-embedqa-e5-v5', color: '#06b6d4' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-2.5 px-1">
              <Icon size={12} style={{ color }} />
              <span className="truncate text-xs text-text-muted">{label}</span>
            </div>
          ))}
        </div>

        <div
          className={clsx(
            'flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-500',
            connected ? 'border-accent-green/20 bg-accent-green/5 text-accent-green' : 'border-accent-red/20 bg-accent-red/5 text-accent-red'
          )}
        >
          <div className="relative shrink-0">
            <div className={clsx('h-2 w-2 rounded-full', connected ? 'bg-accent-green' : 'bg-accent-red')} />
            {connected && <div className="absolute inset-0 rounded-full bg-accent-green opacity-60 animate-ping" />}
          </div>
          {connected ? (
            <>
              <Wifi size={11} />
              <span>WebSocket Live</span>
            </>
          ) : (
            <>
              <WifiOff size={11} />
              <span>Reconnecting…</span>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-bg-card/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">UX Mode</p>
          <p className="mt-2 text-sm font-medium text-text-primary">Dynamic + responsive</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Live status, animated steps, refresh controls, and mobile-safe navigation are active.
          </p>
        </div>
      </div>
    </aside>
  );
}
