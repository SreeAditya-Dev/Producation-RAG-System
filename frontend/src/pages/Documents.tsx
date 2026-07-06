import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RefreshCw, FileText, DatabaseZap, RotateCcw, ShieldCheck } from 'lucide-react';
import { documentsApi } from '../services/api';
import { DocumentUpload } from '../components/documents/DocumentUpload';
import { DocumentList } from '../components/documents/DocumentList';
import { usePipelineCtx } from '../components/layout/Layout';
import { PipelineVisualizer } from '../components/visualizer/PipelineVisualizer';

export function Documents() {
  const qc = useQueryClient();
  const { pipeline, eventLog } = usePipelineCtx();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const last = eventLog[0];
    if (last?.event === 'ingestion_completed' || last?.event === 'ingestion_failed') {
      qc.invalidateQueries({ queryKey: ['documents'] });
    }
  }, [eventLog, qc]);

  useEffect(() => {
    const handler = () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['documents'] });
    };

    window.addEventListener('rag:refresh', handler);
    return () => window.removeEventListener('rag:refresh', handler);
  }, [qc, refetch]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="space-y-8">
        <section className="rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] p-6 shadow-card">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/5 px-3 py-1 text-xs font-medium text-orange-500">
                <ShieldCheck size={12} />
                Ingestion Workspace
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Manage every document from upload to vector storage.
              </h2>
              <p className="mt-3 max-w-2xl text-xs leading-5 text-[#a1a1aa] sm:text-sm">
                Upload files, track live pipeline progress, and manage the knowledge-base inventory. Live updates ensure visibility of each processing layer.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                { icon: FileText, label: 'Tracked docs', value: data?.total ?? 0 },
                { icon: DatabaseZap, label: 'Pipeline stage', value: pipeline.stage },
                { icon: RefreshCw, label: 'Auto refresh', value: '5s' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl border border-[#1c1c1f] bg-[#121215] p-4">
                  <Icon size={16} className="text-orange-500" />
                  <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#71717a]">{label}</p>
                  <p className="mt-1 text-base font-semibold capitalize text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-lg border border-[#1c1c1f] bg-[#121215] px-4 py-2 text-xs font-medium text-[#a1a1aa] transition hover:bg-[#18181b] hover:text-white"
            >
              <RefreshCw size={14} />
              Refresh documents
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-medium text-white transition-colors"
            >
              <RotateCcw size={14} />
              Reload UI
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <div className="rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] p-5 shadow-card">
              <h2 className="mb-4 text-xs uppercase tracking-wider text-[#71717a] font-bold">Upload Document</h2>
              <DocumentUpload onUploaded={() => qc.invalidateQueries({ queryKey: ['documents'] })} />
            </div>

            <PipelineVisualizer state={pipeline} />

            <div className="rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] p-5 shadow-card">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#71717a]">Workflow steps</p>
              <div className="mt-4 space-y-3">
                {[
                  '1. Upload the file and start ingestion immediately.',
                  '2. Watch parsing, chunking, embeddings, and storage update live.',
                  '3. Refresh the inventory or reload the UI if you want a hard visual reset.',
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-[#1c1c1f] bg-[#121215] px-4 py-3 text-xs text-[#a1a1aa]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] p-5 shadow-card">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xs uppercase tracking-wider text-[#71717a] font-bold">
                Knowledge Base
                {data && (
                  <span className="ml-2 text-xs font-normal text-[#52525b]">
                    ({data.total} document{data.total !== 1 ? 's' : ''})
                  </span>
                )}
              </h2>
              <div className="rounded-full border border-[#1c1c1f] bg-[#121215] px-3 py-1 text-[10px] text-[#a1a1aa]">
                Syncs automatically after ingestion events
              </div>
            </div>
            <DocumentList
              documents={data?.documents ?? []}
              onDeleted={() => qc.invalidateQueries({ queryKey: ['documents'] })}
              loading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
