import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText, Layers, MessageSquare, Database,
  TrendingUp, Activity, Zap, CheckCircle2,
} from 'lucide-react';
import { systemApi } from '../services/api';
import { usePipelineCtx } from '../components/layout/Layout';
import { PipelineVisualizer } from '../components/visualizer/PipelineVisualizer';
import { QueryVisualizer } from '../components/visualizer/QueryVisualizer';

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-card border border-border rounded-2xl p-5 hover:border-border-light transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-xs font-medium uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-text-primary mt-2">{value}</p>
          {sub && <p className="text-text-muted text-xs mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={19} className="text-white" />
        </div>
      </div>
    </motion.div>
  );
}

export function Dashboard() {
  const { pipeline, queryState, eventLog } = usePipelineCtx();

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => systemApi.stats().then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => systemApi.health().then((r) => r.data),
    refetchInterval: 30000,
  });

  const recentEvents = eventLog.slice(0, 8);

  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-muted text-sm mt-1">RAG System — NVIDIA NIM + Pinecone</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Documents"
          value={stats?.total_documents ?? '—'}
          sub="indexed & ready"
          color="bg-accent-purple"
        />
        <StatCard
          icon={Layers}
          label="Vector Chunks"
          value={stats?.total_chunks ?? '—'}
          sub={`in Pinecone index`}
          color="bg-accent-cyan"
        />
        <StatCard
          icon={MessageSquare}
          label="Queries Run"
          value={stats?.total_queries ?? '—'}
          sub="total queries"
          color="bg-accent-orange"
        />
        <StatCard
          icon={Database}
          label="Index Vectors"
          value={stats?.index_stats?.total_vector_count ?? '—'}
          sub={`dim: ${stats?.index_stats?.dimension ?? '—'}`}
          color="bg-accent-green"
        />
      </div>

      {/* Services status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-2xl p-4">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-3">Services</p>
          <div className="space-y-2">
            {[
              { label: 'Pinecone Vector DB', status: health?.pinecone === 'connected' },
              { label: 'NVIDIA NIM API', status: health?.nvidia === 'configured' },
              { label: 'FastAPI Backend', status: health?.status === 'ok' },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{label}</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${status ? 'bg-accent-green animate-pulse' : 'bg-accent-red'}`} />
                  <span className={`text-xs ${status ? 'text-accent-green' : 'text-accent-red'}`}>
                    {status ? 'Connected' : 'Error'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent events */}
        <div className="bg-bg-card border border-border rounded-2xl p-4">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-3">Recent Events</p>
          {recentEvents.length === 0 ? (
            <p className="text-text-muted text-xs">No events yet. Upload a document to start.</p>
          ) : (
            <div className="space-y-1.5">
              {recentEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    e.type === 'success' ? 'bg-accent-green' :
                    e.type === 'error' ? 'bg-accent-red' :
                    e.type === 'warning' ? 'bg-accent-orange' : 'bg-text-muted'
                  }`} />
                  <span className="text-text-secondary truncate">{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline visualizers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PipelineVisualizer state={pipeline} />
        <QueryVisualizer state={queryState} />
      </div>
    </div>
  );
}
