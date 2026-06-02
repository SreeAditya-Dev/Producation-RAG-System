import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, MessageSquare, Activity, Zap, Cpu } from 'lucide-react';
import { clsx } from 'clsx';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/query', icon: MessageSquare, label: 'Query' },
  { to: '/visualizer', icon: Activity, label: 'Visualizer' },
];

interface SidebarProps {
  connected: boolean;
}

export function Sidebar({ connected }: SidebarProps) {
  return (
    <aside className="w-60 bg-bg-secondary border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <div className="text-text-primary font-semibold text-sm leading-tight">RAG System</div>
            <div className="text-text-muted text-xs">Powered by NVIDIA NIM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-accent-purple/20 text-accent-purple-light border border-accent-purple/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Status bar */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2.5 text-xs">
          <Cpu size={13} className="text-text-muted flex-shrink-0" />
          <span className="text-text-muted truncate">nvidia/llama-3.3-70b</span>
        </div>
        <div className="flex items-center gap-2.5 mt-2 text-xs">
          <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', connected ? 'bg-accent-green animate-pulse' : 'bg-accent-red')} />
          <span className={connected ? 'text-accent-green' : 'text-accent-red'}>
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
        </div>
      </div>
    </aside>
  );
}
