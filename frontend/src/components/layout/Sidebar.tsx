import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, MessageSquare, Activity, Cpu, Wifi, WifiOff, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', color: '#a855f7' },
  { to: '/documents', icon: FileText, label: 'Documents', color: '#06b6d4' },
  { to: '/query', icon: MessageSquare, label: 'Query', color: '#10b981' },
  { to: '/visualizer', icon: Activity, label: 'Live Pipeline', color: '#f59e0b' },
];

interface SidebarProps {
  connected: boolean;
}

export function Sidebar({ connected }: SidebarProps) {
  return (
    <aside className="w-64 bg-bg-secondary border-r border-border flex flex-col h-full shrink-0 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-accent-purple/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-0 w-24 h-24 bg-accent-cyan/6 rounded-full blur-2xl pointer-events-none" />

      {/* Logo */}
      <div className="px-5 py-5 border-b border-border relative">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0">
            {/* Outer rotating ring */}
            <svg className="absolute inset-0 w-full h-full ring-rotate" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="url(#logo-ring)" strokeWidth="1.5" strokeDasharray="8 4" />
              <defs>
                <linearGradient id="logo-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
            {/* Inner core */}
            <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center shadow-neon-purple">
              <span className="text-white font-bold text-xs">R</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-text-primary font-bold text-sm tracking-wide">RAG System</div>
            <div className="text-text-muted text-xs mt-0.5 truncate">NVIDIA NIM + Pinecone</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 relative">
        {links.map(({ to, icon: Icon, label, color }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden',
                isActive
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/3'
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
                  <div
                    className="absolute inset-0 rounded-xl"
                    style={{ boxShadow: `inset 0 0 20px ${color}12` }}
                  />
                )}
                <div className="relative flex items-center gap-3 w-full">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                    style={isActive ? { background: `${color}25` } : {}}
                  >
                    <Icon size={16} style={isActive ? { color } : {}} />
                  </div>
                  <span>{label}</span>
                  {isActive && (
                    <ChevronRight size={13} className="ml-auto opacity-50" style={{ color }} />
                  )}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider with gradient */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Stack info */}
      <div className="px-4 py-4 space-y-3">
        <div className="space-y-2">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider px-1">Stack</p>
          {[
            { icon: Cpu, label: 'Llama-3.3-70B', color: '#a855f7' },
            { icon: Activity, label: 'nv-embedqa-e5-v5', color: '#06b6d4' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-2.5 px-1">
              <Icon size={12} style={{ color }} />
              <span className="text-text-muted text-xs truncate">{label}</span>
            </div>
          ))}
        </div>

        {/* WS Status */}
        <div className={clsx(
          'flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-500',
          connected
            ? 'border-accent-green/20 bg-accent-green/5 text-accent-green'
            : 'border-accent-red/20 bg-accent-red/5 text-accent-red'
        )}>
          <div className="relative shrink-0">
            <div className={clsx(
              'w-2 h-2 rounded-full',
              connected ? 'bg-accent-green' : 'bg-accent-red'
            )} />
            {connected && (
              <div className="absolute inset-0 rounded-full bg-accent-green animate-ping opacity-60" />
            )}
          </div>
          {connected ? (
            <><Wifi size={11} /><span>WebSocket Live</span></>
          ) : (
            <><WifiOff size={11} /><span>Reconnecting…</span></>
          )}
        </div>
      </div>
    </aside>
  );
}
