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
        <section className="rounded-[28px] border border-border bg-[radial-gradient(circle_at_left,rgba(6,182,212,0.16),transparent_22%),radial-gradient(circle_at_right,rgba(16,185,129,0.14),transparent_24%),linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-card sm:p-8">
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-green/20 bg-accent-green/10 px-3 py-1 text-xs font-medium text-accent-green">
                <ShieldCheck size={12} />
                Responsive ingestion workspace
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                Manage every document from upload to vector storage.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                The screen now separates the workflow into upload, live pipeline progress, and knowledge-base inventory so the full path feels clear on both desktop and mobile.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                { icon: FileText, label: 'Tracked docs', value: data?.total ?? 0 },
                { icon: DatabaseZap, label: 'Pipeline stage', value: pipeline.stage },
                { icon: RefreshCw, label: 'Auto refresh', value: '5s' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-border bg-black/20 p-4">
                  <Icon size={16} className="text-accent-blue" />
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-text-muted">{label}</p>
                  <p className="mt-1 text-lg font-semibold capitalize text-text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-2xl border border-border bg-bg-card px-4 py-2.5 text-sm text-text-secondary transition hover:border-border-light hover:text-text-primary"
            >
              <RefreshCw size={14} />
              Refresh documents
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent-purple to-accent-violet px-4 py-2.5 text-sm font-medium text-white"
            >
              <RotateCcw size={14} />
              Reload UI
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-border bg-bg-card/90 p-5 shadow-card">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">Upload Document</h2>
              <DocumentUpload onUploaded={() => qc.invalidateQueries({ queryKey: ['documents'] })} />
            </div>

            <PipelineVisualizer state={pipeline} />

            <div className="rounded-[24px] border border-border bg-bg-card/90 p-5 shadow-card">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-text-muted">Workflow steps</p>
              <div className="mt-4 space-y-3">
                {[
                  '1. Upload the file and start ingestion immediately.',
                  '2. Watch parsing, chunking, embeddings, and storage update live.',
                  '3. Refresh the inventory or reload the UI if you want a hard visual reset.',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-border bg-black/10 px-4 py-3 text-sm text-text-secondary">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-bg-card/90 p-5 shadow-card">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-text-primary">
                Knowledge Base
                {data && (
                  <span className="ml-2 text-xs font-normal text-text-muted">
                    {data.total} document{data.total !== 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <div className="rounded-full border border-border bg-black/10 px-3 py-1 text-xs text-text-secondary">
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
