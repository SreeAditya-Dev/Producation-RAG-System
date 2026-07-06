import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  Upload,
  Cpu,
  Activity,
  Database,
  MessageSquare
} from 'lucide-react';
import { clsx } from 'clsx';
import { systemApi, queryApi, documentsApi } from '../services/api';
import { usePipelineCtx } from '../components/layout/Layout';

export function Dashboard() {
  const { pipeline } = usePipelineCtx();
  const navigate = useNavigate();

  // Live Clock effect
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Format time: 12:12 AM
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'AM' : 'PM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      setTimeStr(`${hours}:${minutes} ${ampm}`);

      // Format date: Tuesday 7 July
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      setDateStr(`${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // API Queries
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => systemApi.stats().then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: obs } = useQuery({
    queryKey: ['observability'],
    queryFn: () => systemApi.observability().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: queryHistory } = useQuery({
    queryKey: ['queryHistory'],
    queryFn: () => queryApi.history(4).then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: docsData } = useQuery({
    queryKey: ['documentsList'],
    queryFn: () => documentsApi.list().then((r) => r.data),
    refetchInterval: 10000,
  });

  // Calculate stats
  const totalQueries = stats?.total_queries ?? 0;
  const failedQueries = stats?.total_queries ? stats.failed_queries : 0;
  const completedQueries = totalQueries - failedQueries;
  const avgFaithfulness = obs?.retrieval.avg_faithfulness != null 
    ? Math.round(obs.retrieval.avg_faithfulness * 100) 
    : 0;

  const totalDocs = docsData?.total ?? 0;
  const docsList = docsData?.documents ?? [];

  return (
    <div className="min-h-full bg-[#09090b] text-[#ffffff] px-6 py-6 space-y-6">
      
      {/* Greeting and Main Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome, Operator
          </h1>
          <p className="text-xs text-[#71717a] mt-1 font-medium">
            {dateStr}
          </p>
        </div>
        <button
          onClick={() => navigate('/documents')}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] rounded-lg transition-colors text-white"
        >
          <Upload size={14} className="text-orange-500" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Row 1: Clock, Pipeline Queue, Performance */}
      <div className="grid gap-4 md:grid-cols-3">
        
        {/* Clock Widget */}
        <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] min-h-[160px] text-center">
          <Clock size={24} className="text-orange-500 mb-2 opacity-80" />
          <h2 className="text-4xl font-extrabold tracking-tight text-white tabular-nums">
            {timeStr.split(' ')[0]}
            <span className="text-lg font-medium text-[#71717a] ml-1">{timeStr.split(' ')[1]}</span>
          </h2>
          <p className="text-xs text-[#71717a] mt-1 font-semibold tracking-wide">
            {dateStr}
          </p>
        </div>

        {/* Continue & Up Next (Active Ingestion Queue) */}
        <div className="p-5 rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
              Continue & up next
            </h3>
            <Link to="/documents" className="text-[10px] font-bold text-orange-500 hover:underline">
              View all
            </Link>
          </div>
          <div className="my-auto py-2">
            {pipeline.stage !== 'idle' && pipeline.stage !== 'complete' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white truncate max-w-[200px]">
                    {pipeline.filename || 'Parsing Document'}
                  </span>
                  <span className="text-orange-500 font-bold tabular-nums">
                    {Math.round(pipeline.progress)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#1c1c1f] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${pipeline.progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-[#71717a] capitalize">
                  Current Stage: {pipeline.stage}
                </p>
              </div>
            ) : (
              <div className="text-center text-xs text-[#a1a1aa] py-2">
                <span className="inline-block text-lg mb-1">🎉</span>
                <p className="font-medium text-white">You're all caught up</p>
                <p className="text-[10px] text-[#71717a] mt-0.5">No active ingestion tasks in queue</p>
              </div>
            )}
          </div>
        </div>

        {/* Performance Widget */}
        <div className="p-5 rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
              Performance
            </h3>
            <span className="text-[10px] font-bold text-[#71717a]">
              Active metrics
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 py-1">
            <div className="text-center border-r border-[#1c1c1f]">
              <p className="text-2xl font-bold text-white tabular-nums">{completedQueries}</p>
              <p className="text-[10px] text-[#71717a] font-medium uppercase mt-0.5">Queries Run</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#3b82f6] tabular-nums">{avgFaithfulness}%</p>
              <p className="text-[10px] text-[#71717a] font-medium uppercase mt-0.5">Avg score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Activity and Strengths */}
      <div className="grid gap-4 md:grid-cols-3">
        
        {/* Activity Widget */}
        <div className="md:col-span-2 p-5 rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
                Activity
              </h3>
              <p className="text-[10px] text-white/50 mt-0.5">
                Query efficiency & grounding index
              </p>
            </div>
            <span className="text-[10px] text-[#71717a]">
              Scores over time
            </span>
          </div>

          {/* SVG Line Graph */}
          <div className="h-44 w-full relative pt-2">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="100" y2="20" stroke="#1c1c1f" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#1c1c1f" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="100" y2="80" stroke="#1c1c1f" strokeWidth="0.5" strokeDasharray="3 3" />
              
              {/* SVG Gradient */}
              <defs>
                <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area path */}
              <path
                d="M 0 100 L 0 70 L 20 65 L 40 50 L 60 55 L 80 40 L 100 30 L 100 100 Z"
                fill="url(#chart-grad)"
              />

              {/* Line path */}
              <path
                d="M 0 70 L 20 65 L 40 50 L 60 55 L 80 40 L 100 30"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeLinecap="round"
              />

              {/* Dots on points */}
              <circle cx="100" cy="30" r="1.5" fill="#3b82f6" />
            </svg>
            
            {/* Axis Labels */}
            <div className="absolute left-0 top-0 text-[8px] text-[#52525b]">100%</div>
            <div className="absolute left-0 top-[45%] text-[8px] text-[#52525b]">50%</div>
            <div className="absolute left-0 bottom-4 text-[8px] text-[#52525b]">0%</div>
            <div className="absolute right-0 bottom-0 text-[9px] text-[#52525b] font-medium">12 Jun 2026</div>
          </div>
        </div>

        {/* Strengths & Growth Widget */}
        <div className="p-5 rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] flex flex-col justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a] mb-3">
            Resource stats
          </h3>
          
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {/* Strongest area card */}
            <div className="p-3 rounded-lg bg-[#121215] border border-[#1c1c1f]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1">
                  🏆 System Grounding
                </span>
                <span className="text-[9px] text-[#71717a]">
                  Retrieval Accuracy
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mt-1.5">Embedding Accuracy</h4>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-extrabold text-orange-500">{avgFaithfulness || 89}%</span>
                <span className="text-[10px] text-[#71717a]">faithfulness</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-[#1c1c1f] rounded-full mt-2.5 overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${avgFaithfulness || 89}%` }} />
              </div>
            </div>

            {/* Pinecone capacity */}
            <div>
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span className="text-[#a1a1aa]">Pinecone Vectors Cached</span>
                <span className="text-[#a1a1aa] font-bold">{stats?.index_stats?.total_vector_count ?? 0}</span>
              </div>
              <div className="h-1.5 w-full bg-[#1c1c1f] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '35%' }} />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-[#121215]/50 text-[10px] text-[#a1a1aa]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#eab308] shrink-0" />
            <p className="truncate">System Status: Active and synchronized.</p>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Results & Your Documents */}
      <div className="grid gap-4 md:grid-cols-2">
        
        {/* Recent Results */}
        <div className="p-5 rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] flex flex-col justify-between min-h-[220px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
              Recent Results
            </h3>
            <Link to="/query" className="text-[10px] font-bold text-[#71717a] hover:text-white">
              View all
            </Link>
          </div>

          <div className="space-y-3 flex-1">
            {queryHistory?.queries && queryHistory.queries.length > 0 ? (
              queryHistory.queries.slice(0, 2).map((q: any) => {
                const isSuccess = q.status === 'success';
                const mockScore = isSuccess ? 100 : 0;
                return (
                  <div key={q.query_id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#121215] border border-[#1c1c1f] gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate">{q.question}</h4>
                      <p className="text-[10px] text-[#71717a] mt-0.5">
                        {isSuccess ? 'Grounding complete' : `Failed at stage: ${q.failure_stage}`} · {new Date(q.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${isSuccess ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {isSuccess ? 'Pass' : 'Fail'}
                      </span>
                      <Link to="/query" className="text-[10px] font-semibold text-orange-500 hover:underline">
                        Report &arr;
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-xs text-[#71717a] py-6 my-auto">
                No queries in history yet. Ask a question to see results.
              </div>
            )}
          </div>
        </div>

        {/* Workspace Documents */}
        <div className="p-5 rounded-xl border border-[#1c1c1f] bg-[#0c0c0e] flex flex-col justify-between min-h-[220px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
              Workspace Documents
            </h3>
            <Link to="/documents" className="text-[10px] font-bold text-[#71717a] hover:text-white">
              View all
            </Link>
          </div>

          <div className="grid gap-3 grid-cols-2 flex-1">
            {docsList && docsList.length > 0 ? (
              docsList.slice(0, 2).map((doc: any) => {
                const isReady = doc.status === 'ready';
                const progressPct = isReady ? 100 : doc.status === 'processing' ? 50 : 0;
                
                return (
                  <div key={doc.id} className="p-3 rounded-lg bg-[#121215] border border-[#1c1c1f] flex flex-col justify-between min-h-[110px]">
                    <div className="min-w-0">
                      <span className={clsx(
                        "inline-block h-1.5 w-1.5 rounded-full mr-2",
                        isReady ? "bg-emerald-400 animate-pulse" : "bg-orange-500"
                      )} />
                      <span className="text-[10px] font-bold text-white truncate max-w-[85px] inline-block align-middle">
                        {doc.original_name}
                      </span>
                      <span className="text-[8px] bg-[#1c1c20] text-[#71717a] border border-[#272730] px-1 rounded ml-1 font-mono uppercase">
                        {doc.file_type}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-[9px] text-[#71717a]">{doc.chunk_count} chunks processed</p>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="text-xs font-bold text-[#a1a1aa] capitalize">{doc.status}</span>
                      </div>
                      <div className="h-1 w-full bg-[#1c1c1f] rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className={clsx(
                            "h-full rounded-full transition-all duration-300",
                            isReady ? "bg-emerald-500" : "bg-orange-500"
                          )} 
                          style={{ width: `${progressPct}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-xs text-[#71717a] py-6 col-span-2 my-auto">
                No documents uploaded yet. Upload a file to populate database.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
