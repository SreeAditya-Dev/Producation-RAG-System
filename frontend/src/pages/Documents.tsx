import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Search } from 'lucide-react';
import { documentsApi } from '../services/api';
import { DocumentUpload } from '../components/documents/DocumentUpload';
import { DocumentList } from '../components/documents/DocumentList';
import { usePipelineCtx } from '../components/layout/Layout';
import { PipelineVisualizer } from '../components/visualizer/PipelineVisualizer';

export function Documents() {
  const qc = useQueryClient();
  const { pipeline, eventLog } = usePipelineCtx();
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="px-6 py-6 sm:px-8 lg:py-8 max-w-[1600px] mx-auto">
      <div className="space-y-6">
        {/* Top Header Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Document Control</h1>
            <p className="text-zinc-500 text-xs mt-1">Upload, process, and track your ingestion layers.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input Box */}
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-zinc-500">
                <Search size={13} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-56 pl-8 pr-3 py-1.5 text-[11px] bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 rounded-md text-white placeholder-zinc-500 focus:outline-none transition-all font-mono"
              />
            </div>

            {/* Refresh button */}
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-800 bg-[#0c0c0e] hover:bg-zinc-900/60 hover:text-white text-zinc-400 text-[11px] transition-all font-mono"
              title="Refresh inventory"
            >
              <RefreshCw size={11} />
              Refresh
            </button>

            {/* Reload UI button */}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-800 bg-[#0c0c0e] hover:bg-zinc-900/60 hover:text-white text-zinc-400 text-[11px] transition-all font-mono"
              title="Reload UI state"
            >
              <RotateCcw size={11} />
              Reset UI
            </button>
          </div>
        </div>

        {/* Master-Detail Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* Left Column: Control Center */}
          <div className="space-y-6">
            {/* Upload Box */}
            <div className="border border-zinc-800 bg-[#0c0c0e] p-4 rounded-lg">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono mb-3">Upload payload</p>
              <DocumentUpload onUploaded={() => qc.invalidateQueries({ queryKey: ['documents'] })} />
            </div>

            {/* Ingestion Visualizer */}
            <PipelineVisualizer state={pipeline} />

            {/* Steps & Integration Guide */}
            <div className="border border-zinc-800 bg-[#0c0c0e] p-4 rounded-lg">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono mb-3">Ingestion lifecycle</p>
              <div className="space-y-2.5">
                {[
                  'Upload raw PDF, DOCX, TXT, or MD payload sources.',
                  'Engine parsing isolates structural text and metadata.',
                  'Text slices recursively chunked for optimal semantic length.',
                  'Embeddings generated using active NIM neural architectures.',
                  'Vectors upserted into Pinecone storage and synchronized.',
                ].map((step, idx) => (
                  <div key={idx} className="flex gap-2.5 text-[10px] text-zinc-400 leading-normal font-mono">
                    <span className="text-zinc-600 shrink-0">0{idx + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Inventory Database */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Document inventory</span>
                {data && (
                  <span className="font-mono text-[9px] bg-zinc-950 border border-zinc-850 px-1.5 py-0.5 rounded text-zinc-400">
                    {data.total} records
                  </span>
                )}
              </div>
              <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">Telemetry auto-synced</span>
            </div>

            <DocumentList
              documents={data?.documents ?? []}
              onDeleted={() => qc.invalidateQueries({ queryKey: ['documents'] })}
              loading={isLoading}
              searchQuery={searchQuery}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
