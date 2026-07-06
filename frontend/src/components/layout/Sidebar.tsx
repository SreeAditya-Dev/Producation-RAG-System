import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Activity,
  Cpu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', color: '#F4831F' },
  { to: '/documents', icon: FileText, label: 'Documents', color: '#3b82f6' },
  { to: '/query', icon: MessageSquare, label: 'Query', color: '#10b981' },
  { to: '/visualizer', icon: Activity, label: 'Live Pipeline', color: '#f59e0b' },
];

interface SidebarProps {
  connected: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  connected,
  mobile = false,
  onNavigate,
  collapsed = false,
  onToggleCollapse
}: SidebarProps) {
  const isCollapsed = collapsed && !mobile;

  return (
    <aside
      className={clsx(
        'flex shrink-0 flex-col overflow-hidden text-white transition-all duration-300 ease-in-out',
        mobile 
          ? 'h-screen w-[292px] border-r border-[#1e1e24] bg-[#09090b] shadow-2xl'
          : clsx(
              'h-[calc(100vh-32px)] m-4 rounded-2xl border border-white/5 bg-[#09090b]/90 backdrop-blur-xl shadow-2xl shadow-black/80',
              isCollapsed ? 'w-[76px]' : 'w-[260px]'
            )
      )}
    >
      {/* Brand Header */}
      <div className={clsx(
        'py-6 flex items-center transition-all duration-300',
        isCollapsed ? 'justify-center px-0' : 'px-6 gap-3'
      )}>
        {/* Simple orange circle icon similar to the Mentor logo */}
        <div className="relative h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <div className="h-3 w-3 rounded-full bg-[#0c0c0e]" />
          <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-400" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-white leading-none">
              RAG <span className="text-orange-500 font-medium">Assistant</span>
            </h2>
            <p className="mt-1 text-[10px] text-[#7c7c8c] font-semibold uppercase tracking-wider">
              System Workspace
            </p>
          </div>
        )}
      </div>

      {/* Menu Sections */}
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto no-scrollbar">
        <div>
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#4c4c5c] mb-2">
              Workspace
            </p>
          )}
          <nav className={clsx('space-y-1', isCollapsed && 'flex flex-col items-center')}>
            {links.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'group relative flex items-center transition-all duration-200 text-sm font-medium',
                    isCollapsed 
                      ? 'justify-center rounded-xl w-12 h-12 hover:bg-[#18181b]/50'
                      : 'gap-3 rounded-xl px-4 py-2.5 text-[#8b8b9f] hover:bg-[#18181b]/50 hover:text-white',
                    isActive 
                      ? isCollapsed 
                        ? 'bg-[#18181b] text-orange-500 border-l-2 border-orange-500 rounded-l-none'
                        : 'bg-[#18181b] text-white border-l-2 border-orange-500 pl-[14px]'
                      : 'text-[#8b8b9f] hover:text-white'
                  )
                }
                title={isCollapsed ? label : undefined}
              >
                <Icon size={16} className="text-[#8b8b9f] group-hover:text-white transition-colors" />
                {!isCollapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Stack Info */}
        {!isCollapsed && (
          <div className="px-3 py-2 rounded-xl bg-[#121215] border border-[#1e1e24] space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5c5c6c]">
              Active Stack
            </p>
            <div className="space-y-1.5">
              {[
                { icon: Cpu, label: 'Llama-3.3-70B NIM' },
                { icon: Activity, label: 'nv-embedqa-e5-v5' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={12} className="text-orange-500" />
                  <span className="truncate text-xs text-[#a1a1aa]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Profile */}
      <div className="p-3 border-t border-[#1e1e24] bg-[#09090b] space-y-4">
        {/* Connection status */}
        {!isCollapsed ? (
          <div
            className={clsx(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium transition-all duration-500',
              connected ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'
            )}
          >
            <div className="relative shrink-0">
              <div className={clsx('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')} />
              {connected && <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping" />}
            </div>
            <span>Live System Link</span>
          </div>
        ) : (
          <div className="flex justify-center" title={connected ? 'Live System Link Established' : 'Connection Interrupted'}>
            <div className="relative">
              <div className={clsx('h-2 w-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')} />
              {connected && <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping" />}
            </div>
          </div>
        )}

        {/* Collapse action button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            type="button"
            className={clsx(
              'flex items-center gap-2 w-full text-xs font-semibold text-[#8b8b9f] hover:text-white transition-colors py-1',
              isCollapsed ? 'justify-center' : 'px-2'
            )}
          >
            {isCollapsed ? (
              <ChevronRight size={14} className="text-orange-500" />
            ) : (
              <>
                <ChevronLeft size={14} className="text-orange-500" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        )}

        {/* System Node Indicator */}
        {isCollapsed ? (
          <div 
            className="h-10 w-10 mx-auto rounded-xl bg-[#121215] border border-[#1e1e24] flex items-center justify-center text-xs font-bold text-orange-500/70"
            title="System Workspace (Local Node)"
          >
            SYS
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-[#121215] border border-[#1e1e24]">
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-500">
              SYS
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">System Workspace</h4>
              <p className="text-[10px] text-[#71717a] truncate">Local Server Node</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
