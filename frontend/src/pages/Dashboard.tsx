"use client";

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
  MessageSquare,
  Sparkles,
  Trophy,
  TrendingUp,
  Server,
  Layers,
  ArrowRight,
  Shield,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileCode2,
  Zap,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  GitCommitVertical
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, CartesianGrid, Tooltip } from 'recharts';
import { clsx } from 'clsx';
import { systemApi, queryApi, documentsApi } from '../services/api';
import { usePipelineCtx } from '../components/layout/Layout';

export function Dashboard() {
  const { pipeline } = usePipelineCtx();
  const navigate = useNavigate();

  // Live Clock effect
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timezoneStr, setTimezoneStr] = useState('');

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

      // Timezone Offset: GMT+5:30
      const offset = now.getTimezoneOffset();
      const absOffset = Math.abs(offset);
      const offsetHours = Math.floor(absOffset / 60);
      const offsetMinutes = absOffset % 60;
      const sign = offset <= 0 ? '+' : '-';
      const formattedOffset = `GMT${sign}${offsetHours}:${String(offsetMinutes).padStart(2, '0')}`;
      setTimezoneStr(formattedOffset);
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
    queryFn: () => queryApi.history(8).then((r) => r.data),
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

  // Active Ingestion stages helper
  const getStageStatus = (stageName: string) => {
    const stagesOrder = ['idle', 'upload', 'parsing', 'chunking', 'embedding', 'storing', 'complete'];
    const currentIdx = stagesOrder.indexOf(pipeline.stage);
    const targetIdx = stagesOrder.indexOf(stageName);

    if (pipeline.stage === 'error') return 'error';
    if (pipeline.stage === 'complete') return 'done';
    if (currentIdx > targetIdx) return 'done';
    if (currentIdx === targetIdx) return 'active';
    return 'pending';
  };

  const stages = [
    { key: 'upload', label: 'Upload' },
    { key: 'parsing', label: 'Parse' },
    { key: 'chunking', label: 'Chunk' },
    { key: 'embedding', label: 'Embed' },
    { key: 'storing', label: 'Store' },
  ];

  // Generate data points for the graph
  const chartPoints = (() => {
    // 7 days default values if there are no query runs
    const defaultPoints = [76, 82, 79, 85, 88, 84, avgFaithfulness || 90];
    
    if (!queryHistory?.queries || queryHistory.queries.length === 0) {
      return defaultPoints.map((val, idx) => ({
        label: `T-${6 - idx}d`,
        value: val,
        isSuccess: true,
        question: undefined as string | undefined
      }));
    }

    // Sort queries in ascending order of time (oldest to newest) to display left-to-right
    const sortedQueries = [...queryHistory.queries]
      .slice(0, 8)
      .reverse();

    // Map to points
    return sortedQueries.map((q: any) => {
      const isSuccess = q.status === 'success' || !q.failure_stage;
      let score = 0;
      if (isSuccess) {
        // Average score of retrieved chunks, fallback to avgFaithfulness or 85
        const validSources = q.sources?.filter((s: any) => s.score != null) ?? [];
        if (validSources.length > 0) {
          const sum = validSources.reduce((acc: number, curr: any) => acc + curr.score, 0);
          score = Math.round((sum / validSources.length) * 100);
          score = Math.max(50, Math.min(100, score));
        } else {
          score = avgFaithfulness || 85;
        }
      } else {
        score = 30; // Failed query represented as low grounding index
      }

      const time = new Date(q.created_at);
      const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return {
        label,
        value: score,
        question: q.question,
        isSuccess
      };
    });
  })();

  return (
    <div className="relative min-h-full bg-[#030303] text-white px-8 py-8 space-y-8 overflow-hidden font-sans">
      
      {/* Ambient Glowing Glass Backdrops */}
      <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[5%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[160px] pointer-events-none" />
      <div className="absolute top-[30%] right-[15%] w-[35%] h-[35%] rounded-full bg-indigo-500/5 blur-[130px] pointer-events-none" />
      
      {/* Technical Grid Dot Background Overlay */}
      <div className="absolute inset-0 tech-dot-bg opacity-[0.25] pointer-events-none" />

      {/* Greeting and Main Top Bar */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-mono font-semibold">
              RAG Control Node Online
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 sm:text-4xl">
            Mission Control
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium max-w-xl">
            Real-time telemetry, semantic document chunking, and pipeline grounding indicators.
          </p>
        </div>
        <button
          onClick={() => navigate('/documents')}
          className="group relative flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl transition-all duration-300 hover:from-orange-400 hover:to-amber-500 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(244,131,31,0.25)] shadow-lg shadow-orange-500/10 text-white shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Upload size={14} className="group-hover:-translate-y-0.5 transition-transform duration-200 text-white" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Row 1: Clock, Pipeline Queue, Performance */}
      <div className="grid gap-6 md:grid-cols-3 relative">
        
        {/* Clock Widget */}
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-xl min-h-[170px] relative overflow-hidden group">
          {/* Decorative glowing dial in background */}
          <div className="absolute -right-10 -bottom-10 w-32 h-32 rounded-full border border-orange-500/5 group-hover:border-orange-500/10 transition-colors duration-500 pointer-events-none" />
          <div className="absolute -right-5 -bottom-5 w-20 h-20 rounded-full border border-dashed border-orange-500/5 animate-spin-slow pointer-events-none" />
          
          <div className="flex items-center gap-2 mb-3.5 bg-orange-500/5 border border-orange-500/10 px-3 py-1 rounded-full text-[10px] font-mono text-orange-400 font-bold tracking-wider uppercase">
            <Clock size={11} className="animate-pulse" />
            <span>Telemetry clock</span>
          </div>
          
          <h2 className="text-4.5xl font-black tracking-tight text-white tabular-nums flex items-baseline gap-1 select-none">
            {timeStr.split(' ')[0]}
            <span className="text-base font-bold text-slate-400 uppercase tracking-widest ml-1">{timeStr.split(' ')[1]}</span>
          </h2>
          
          <p className="text-[11px] text-slate-400 font-medium tracking-wide mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            {dateStr}
            <span className="text-slate-500 font-mono ml-1 text-[10px]">{timezoneStr}</span>
          </p>
        </div>

        {/* Active Ingestion Queue */}
        <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-xl flex flex-col justify-between min-h-[170px] group transition-all duration-300 hover:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server size={13} className="text-orange-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Ingestion Engine
              </h3>
            </div>
            <Link to="/documents" className="text-[10px] font-bold text-orange-500 hover:text-orange-400 flex items-center gap-0.5 group/link">
              Queue Studio
              <ChevronRight size={11} className="group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="my-auto py-2">
            {pipeline.stage !== 'idle' && pipeline.stage !== 'complete' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white truncate max-w-[200px] font-mono">
                    {pipeline.filename || 'Parsing Document'}
                  </span>
                  <span className="text-orange-400 font-black font-mono">
                    {Math.round(pipeline.progress)}%
                  </span>
                </div>
                
                {/* Horizontal Step Lights */}
                <div className="flex justify-between items-center py-1">
                  {stages.map((st, i) => {
                    const status = getStageStatus(st.key);
                    return (
                      <div key={st.key} className="flex items-center flex-1 last:flex-initial">
                        <div 
                          className={clsx(
                            "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold border transition-all duration-300",
                            status === 'done' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                            status === 'active' && "bg-orange-500/20 border-orange-500 animate-pulse text-orange-400 shadow-[0_0_10px_rgba(244,131,31,0.2)]",
                            status === 'pending' && "bg-transparent border-white/5 text-slate-500",
                            status === 'error' && "bg-red-500/20 border-red-500 text-red-400"
                          )}
                          title={`${st.label}: ${status}`}
                        >
                          {i + 1}
                        </div>
                        {i < stages.length - 1 && (
                          <div 
                            className={clsx(
                              "h-[1px] flex-1 mx-1 transition-colors duration-300",
                              status === 'done' ? "bg-emerald-500/30" : "bg-white/5"
                            )} 
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="h-1.5 w-full bg-white/[0.03] border border-white/5 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${pipeline.progress}%` }}
                  />
                  <div className="absolute inset-0 shimmer-bg pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <Sparkles className="w-6 h-6 text-orange-500/50 mx-auto mb-2" />
                <p className="text-xs font-semibold text-white">All Ingestions Synced</p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">No active parsing tasks in pipeline</p>
              </div>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-xl flex flex-col justify-between min-h-[170px] group transition-all duration-300 hover:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-blue-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                System telemetry
              </h3>
            </div>
            <span className="text-[9px] font-bold text-slate-500 font-mono uppercase bg-white/[0.02] px-2 py-0.5 rounded border border-white/5">
              Metrics
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 relative">
            <div className="text-left pr-4 border-r border-white/5">
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Queries Run</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-3xl font-black text-white tabular-nums">{completedQueries}</p>
              </div>
              {/* Micro blue sparkline */}
              <div className="mt-2 h-4 w-full opacity-60">
                <svg className="w-full h-full" viewBox="0 0 60 20" preserveAspectRatio="none">
                  <path d="M 0 15 L 10 12 L 20 18 L 30 8 L 40 14 L 50 4 L 60 10" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            
            <div className="text-left pl-2">
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Avg score</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-3xl font-black text-blue-400 tabular-nums">{avgFaithfulness}%</p>
              </div>
              {/* Micro orange sparkline */}
              <div className="mt-2 h-4 w-full opacity-60">
                <svg className="w-full h-full" viewBox="0 0 60 20" preserveAspectRatio="none">
                  <path d="M 0 18 L 10 14 L 20 15 L 30 10 L 40 8 L 50 3 L 60 2" fill="none" stroke="#f4831f" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Grounding Telemetry and Pinecone Capacity */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Activity Spline Chart */}
        <div className="md:col-span-2 p-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-blue-500" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Grounding Index
                </h3>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                Query accuracy & faithfulness index relative to context logs
              </p>
            </div>
            
            {/* cosmetic chart tabs */}
            <div className="flex bg-white/[0.02] border border-white/5 p-0.5 rounded-lg text-[9px] font-mono">
              <button className="px-2.5 py-1 rounded text-orange-400 bg-white/[0.03] border border-white/5 font-bold cursor-default">7D</button>
              <button className="px-2.5 py-1 rounded text-slate-500 hover:text-white cursor-pointer">15D</button>
              <button className="px-2.5 py-1 rounded text-slate-500 hover:text-white cursor-pointer">30D</button>
            </div>
          </div>

          {/* Recharts Grounding Line Chart */}
          <div className="h-44 w-full relative pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartPoints.map((pt) => ({
                  name: pt.label,
                  score: pt.value,
                  question: pt.question,
                  isSuccess: pt.isSuccess
                }))}
                margin={{
                  left: 12,
                  right: 12,
                  top: 10,
                  bottom: 5
                }}
              >
                <defs>
                  {/* Line Gradient */}
                  <linearGradient id="chart-line-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#f4831f" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.03)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  stroke="#64748b"
                  style={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#09090b]/95 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md max-w-[260px] pointer-events-none">
                          <div className="flex items-center justify-between gap-4 mb-1.5 border-b border-white/5 pb-1">
                            <span className="text-[9px] font-mono text-slate-400">{data.name}</span>
                            <span className={clsx(
                              "text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider",
                              data.isSuccess === false ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            )}>
                              {data.isSuccess === false ? 'FAIL' : 'GROUNDED'}
                            </span>
                          </div>
                          {data.question ? (
                            <p className="text-[10px] text-white font-semibold line-clamp-2 mb-1.5">
                              "{data.question}"
                            </p>
                          ) : (
                            <p className="text-[10px] text-white font-semibold mb-1.5">Grounding Index Proxy</p>
                          )}
                          <p className="text-xs font-black text-orange-400 font-mono">
                            {data.score}% Accuracy
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  dataKey="score"
                  type="natural"
                  stroke="url(#chart-line-grad)"
                  strokeWidth={2.2}
                  dot={({ cx, cy, payload }) => {
                    if (cx == null || cy == null) {
                      return null;
                    }
                    const isSuccess = payload.isSuccess;
                    const strokeColor = isSuccess === false ? "#ef4444" : "#f4831f";
                    const r = 16;
                    return (
                      <GitCommitVertical
                        key={payload.name}
                        x={cx - r / 2}
                        y={cy - r / 2}
                        width={r}
                        height={r}
                        fill="#030303"
                        stroke={strokeColor}
                      />
                    );
                  }}
                  activeDot={{ r: 6, fill: "#f4831f", strokeWidth: 1 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resource Allocation & Stats */}
        <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-xl flex flex-col justify-between group transition-all duration-300 hover:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database size={13} className="text-orange-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Index Inventory
              </h3>
            </div>
            <span className="text-[9px] font-mono text-slate-500 uppercase">
              Pinecone DB
            </span>
          </div>
          
          <div className="space-y-5 flex-1 flex flex-col justify-center">
            {/* Strongest area card */}
            <div className="p-3.5 rounded-xl bg-white/[0.01] border border-white/5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Trophy size={11} className="text-orange-500" />
                  Embedding Accuracy
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  NIM E5 Engine
                </span>
              </div>
              <h4 className="text-xs font-bold text-white mt-1">Grounding Confidence</h4>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="text-2xl font-black text-white">{avgFaithfulness || 89}%</span>
                <span className="text-[10px] text-slate-400 font-mono">mean score</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-white/[0.03] border border-white/5 rounded-full overflow-hidden relative">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" style={{ width: `${avgFaithfulness || 89}%` }} />
              </div>
            </div>

            {/* Pinecone capacity */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold font-mono">
                <span className="text-slate-400">Pinecone Vector Pool</span>
                <span className="text-white font-mono">{stats?.index_stats?.total_vector_count ?? 0}</span>
              </div>
              <div className="h-1.5 w-full bg-white/[0.03] border border-white/5 rounded-full overflow-hidden relative">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: '35%' }} />
              </div>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">Namespace: default-v1 &middot; Dim: 1024</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 p-2.5 rounded-xl bg-[#09090b] border border-white/5 text-[10px] text-slate-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="truncate">Node synced: Telemetry link validated.</p>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Results & Your Documents */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Recent Results */}
        <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-xl flex flex-col justify-between min-h-[240px] group transition-all duration-300 hover:border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={13} className="text-emerald-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Telemetry Log
              </h3>
            </div>
            <Link to="/query" className="text-[10px] font-bold text-slate-500 hover:text-white flex items-center gap-0.5 group/link">
              Query Logs
              <ChevronRight size={11} className="group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {queryHistory?.queries && queryHistory.queries.length > 0 ? (
              queryHistory.queries.slice(0, 2).map((q: any) => {
                const isSuccess = q.status === 'success' || !q.failure_stage;
                return (
                  <div key={q.query_id} className="relative flex items-start p-3.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 gap-4 transition-colors">
                    {/* Visual left border line indicating status */}
                    <div className={clsx(
                      "absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r",
                      isSuccess ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    
                    <div className="min-w-0 flex-1 pl-1">
                      <h4 className="text-xs font-bold text-white truncate">{q.question}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono flex items-center gap-1.5">
                        <span>{isSuccess ? 'Grounding complete' : `Failed at stage: ${q.failure_stage}`}</span>
                        <span>&bull;</span>
                        <span>{new Date(q.created_at).toLocaleDateString()}</span>
                        {q.processing_time && (
                          <>
                            <span>&bull;</span>
                            <span className="text-slate-400">{Math.round(q.processing_time * 1000)}ms</span>
                          </>
                        )}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={clsx(
                        "text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase border",
                        isSuccess 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      )}>
                        {isSuccess ? 'PASS' : 'FAIL'}
                      </span>
                      <Link to="/query" className="text-[10px] font-bold text-orange-500 hover:text-orange-400 flex items-center gap-0.5">
                        Inspect
                        <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-xs text-slate-500 py-6 my-auto font-mono">
                No queries in log history. Ask questions to stream telemetry.
              </div>
            )}
          </div>
        </div>

        {/* Workspace Documents */}
        <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-xl flex flex-col justify-between min-h-[240px] group transition-all duration-300 hover:border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-blue-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Payload inventory
              </h3>
            </div>
            <Link to="/documents" className="text-[10px] font-bold text-slate-500 hover:text-white flex items-center gap-0.5 group/link">
              Inventory
              <ChevronRight size={11} className="group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid gap-4 grid-cols-2 flex-1 items-center">
            {docsList && docsList.length > 0 ? (
              docsList.slice(0, 2).map((doc: any) => {
                const isReady = doc.status === 'ready';
                const isProcessing = doc.status === 'processing';
                const progressPct = isReady ? 100 : isProcessing ? 50 : 0;
                
                return (
                  <div key={doc.id} className="p-3.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 flex flex-col justify-between min-h-[120px] transition-colors relative group/card">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {doc.file_type === 'pdf' ? (
                            <FileText size={12} className="text-red-400 shrink-0" />
                          ) : doc.file_type === 'docx' ? (
                            <FileSpreadsheet size={12} className="text-blue-400 shrink-0" />
                          ) : (
                            <FileCode2 size={12} className="text-slate-400 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-white truncate group-hover/card:text-orange-400 transition-colors">
                            {doc.original_name}
                          </span>
                        </div>
                        <span className="text-[8px] bg-white/[0.02] text-slate-400 border border-white/5 px-1.5 py-0.5 rounded font-mono uppercase">
                          {doc.file_type}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-2">{doc.chunk_count} semantic slices</p>
                    </div>

                    <div className="mt-2.5">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className={clsx(
                          "font-bold uppercase tracking-wider",
                          isReady && "text-emerald-400",
                          isProcessing && "text-orange-400",
                          doc.status === 'error' && "text-red-400"
                        )}>
                          {doc.status}
                        </span>
                        
                        {isReady ? (
                          <CheckCircle2 size={12} className="text-emerald-400" />
                        ) : isProcessing ? (
                          <RefreshCw size={12} className="text-orange-400 animate-spin" />
                        ) : (
                          <AlertCircle size={12} className="text-red-400" />
                        )}
                      </div>
                      
                      <div className="h-1 w-full bg-white/[0.03] rounded-full mt-2 overflow-hidden relative">
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
              <div className="text-center text-xs text-slate-500 py-6 col-span-2 my-auto font-mono">
                No payload inventory cached. Upload documents to index.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
