import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Search, Signal } from 'lucide-react';
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
    <div className="px-6 py-6 mx-auto w-full h-full max-w-[1600px] font-sans text-zinc-300">
      <div className="space-y-6">
        {/* Top Header Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-900">
          <div>
            <h1 className="text-sm font-mono tracking-widest uppercase font-bold text-white flex items-center gap-2">
              <Signal size={13} className="text-[#F4831F]" />
              Document Control
            </h1>
            <p className="text-zinc-550 text-xs mt-1 font-mono">Upload, process, and track your ingestion layers.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input Box */}
            <div className="relative flex items-center border border-zinc-800 rounded bg-zinc-950 focus-within:border-[#F4831F]/50 transition-colors">
              <span className="absolute left-2.5 text-zinc-600">
                <Search size={12} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-52 pl-8 pr-3 py-1.5 text-[11px] bg-transparent text-white placeholder-zinc-600 focus:outline-none transition-all font-mono"
              />
            </div>

            {/* Refresh button */}
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-800 bg-[#000000] hover:bg-zinc-900/60 hover:text-white text-zinc-400 text-[11px] transition-all font-mono cursor-pointer"
              title="Refresh inventory"
            >
              <RefreshCw size={11} />
              Refresh
            </button>

            {/* Reload UI button */}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-800 bg-[#000000] hover:bg-zinc-900/60 hover:text-white text-zinc-400 text-[11px] transition-all font-mono cursor-pointer"
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
            <div className="border border-zinc-800 bg-[#000000] p-5 rounded-lg">
              <p className="text-[9px] uppercase tracking-widest text-[#F4831F] font-semibold font-mono mb-3">Upload payload</p>
              <DocumentUpload onUploaded={() => qc.invalidateQueries({ queryKey: ['documents'] })} />
            </div>

            {/* Ingestion Visualizer */}
            <PipelineVisualizer state={pipeline} />

            {/* Steps & Integration Guide */}
            <div className="border border-zinc-800 bg-[#000000] p-5 rounded-lg">
              <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold font-mono mb-3.5">Ingestion lifecycle</p>
              <div className="space-y-3">
                {[
                  'Upload raw PDF, DOCX, TXT, or MD payload sources.',
                  'Engine parsing isolates structural text and metadata.',
                  'Text slices recursively chunked for optimal semantic length.',
                  'Embeddings generated using active NIM neural architectures.',
                  'Vectors upserted into Pinecone storage and synchronized.',
                ].map((step, idx) => (
                  <div key={idx} className="flex gap-3 text-[10px] text-zinc-400 leading-normal font-mono">
                    <span className="text-[#F4831F] shrink-0 font-bold">0{idx + 1}.</span>
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
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Document inventory</span>
                {data && (
                  <span className="font-mono text-[9px] bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded text-[#F4831F] font-bold">
                    {data.total} records
                  </span>
                )}
              </div>
              <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline uppercase tracking-wider">Telemetry auto-synced</span>
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
export default Documents;
