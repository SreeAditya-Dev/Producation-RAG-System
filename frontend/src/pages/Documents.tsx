import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, FileText } from 'lucide-react';
import { documentsApi } from '../services/api';
import { DocumentUpload } from '../components/documents/DocumentUpload';
import { DocumentList } from '../components/documents/DocumentList';
import { usePipelineCtx } from '../components/layout/Layout';
import { PipelineVisualizer } from '../components/visualizer/PipelineVisualizer';
import { useEffect } from 'react';

export function Documents() {
  const qc = useQueryClient();
  const { pipeline, eventLog } = usePipelineCtx();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
    refetchInterval: 5000,
  });

  // Refetch when ingestion completes
  useEffect(() => {
    const last = eventLog[0];
    if (last?.event === 'ingestion_completed' || last?.event === 'ingestion_failed') {
      qc.invalidateQueries({ queryKey: ['documents'] });
    }
  }, [eventLog, qc]);

  return (
    <div className="px-8 py-8 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Documents</h1>
          <p className="text-text-muted text-sm mt-1">Upload and manage your knowledge base</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 bg-bg-card border border-border rounded-xl text-text-secondary hover:text-text-primary hover:border-border-light transition-colors text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload + Pipeline */}
        <div className="space-y-5">
          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <h2 className="text-text-primary font-semibold text-sm mb-4">Upload Document</h2>
            <DocumentUpload onUploaded={() => qc.invalidateQueries({ queryKey: ['documents'] })} />
          </div>

          <PipelineVisualizer state={pipeline} />
        </div>

        {/* Document list */}
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-text-primary font-semibold text-sm">
              Knowledge Base
              {data && (
                <span className="ml-2 text-text-muted text-xs font-normal">
                  {data.total} document{data.total !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
          </div>
          <DocumentList
            documents={data?.documents ?? []}
            onDeleted={() => qc.invalidateQueries({ queryKey: ['documents'] })}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
