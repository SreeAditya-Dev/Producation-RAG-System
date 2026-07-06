import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Database, 
  Cpu, 
  Activity, 
  Workflow, 
  Code, 
  FileText, 
  Server, 
  ArrowRight, 
  Zap, 
  CheckCircle2, 
  Terminal, 
  Layers, 
  ChevronRight, 
  Info,
  Sliders,
  Play,
  Pause,
  SlidersHorizontal,
  RefreshCw,
  Search,
  Check,
  FileCode,
  Sliders as SlidersIcon,
  HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';

// Simple regex-based syntax tokenizer for Python code snippets
const tokenRules = [
  { type: 'comment', regex: /^#.*/ },
  { type: 'string', regex: /^("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')/ },
  { type: 'keyword', regex: /^\b(class|def|return|import|from|as|in|and|or|not|is|if|else|elif|for|while|try|except|pass)\b/ },
  { type: 'builtin', regex: /^\b(self|True|False|None)\b/ },
  { type: 'type', regex: /^\b(List|Dict|Optional|int|float|str|math|sum|len|round|exp)\b/ },
  { type: 'number', regex: /^\b\d+(\.\d+)?\b/ },
  { type: 'decorator', regex: /^@\w+/ },
  { type: 'operator', regex: /^[+\-*/%=<>!&|^~]+/ },
  { type: 'punctuation', regex: /^[()[\]{},.:;]/ },
  { type: 'whitespace', regex: /^\s+/ },
  { type: 'identifier', regex: /^[a-zA-Z_]\w*/ },
  { type: 'other', regex: /^./ }
];

const tokenize = (code: string) => {
  let temp = code;
  const tokens: { type: string; value: string }[] = [];
  while (temp.length > 0) {
    let matched = false;
    for (const rule of tokenRules) {
      const match = temp.match(rule.regex);
      if (match) {
        tokens.push({ type: rule.type, value: match[0] });
        temp = temp.substring(match[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ type: 'other', value: temp[0] });
      temp = temp.substring(1);
    }
  }
  return tokens;
};

interface CodeBlockProps {
  code: string;
  filename: string;
  language: string;
}

function CodeBlock({ code, filename, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tokens = useMemo(() => tokenize(code), [code]);

  return (
    <div className="border border-zinc-800 bg-[#070709] rounded-xl overflow-hidden shadow-2xl font-mono text-[11px] leading-relaxed group transition-all duration-300 hover:border-zinc-700">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#0c0c0f]/80 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-800" />
            <span className="w-2 h-2 rounded-full bg-zinc-800" />
            <span className="w-2 h-2 rounded-full bg-zinc-800" />
          </span>
          <span className="text-zinc-400 text-[10px] ml-1.5 flex items-center gap-1.5 font-medium">
            <Code size={11} className="text-orange-500" />
            {filename}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] border border-zinc-800 bg-[#0c0c0f] text-zinc-400 hover:border-zinc-700 hover:text-white rounded-md transition-all duration-200 cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-500" />
              <span className="text-emerald-500">Copied!</span>
            </>
          ) : (
            <>
              <FileCode size={11} className="text-zinc-500" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code Area */}
      <div className="p-4 overflow-x-auto bg-[#040406]/60 flex">
        {/* Line Numbers */}
        <div className="text-zinc-600 text-right pr-4 select-none border-r border-zinc-900 min-w-[2rem] text-[10px] leading-5 font-mono">
          {code.split('\n').map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Tokenized Output */}
        <pre className="pl-4 text-zinc-350 select-text whitespace-pre flex-1 font-mono text-[11.5px] leading-5">
          {tokens.map((token, i) => {
            let className = '';
            if (token.type === 'comment') className = 'text-zinc-550 italic';
            else if (token.type === 'string') className = 'text-emerald-400/90';
            else if (token.type === 'keyword') className = 'text-orange-500 font-bold';
            else if (token.type === 'builtin') className = 'text-sky-400/90';
            else if (token.type === 'type') className = 'text-blue-400';
            else if (token.type === 'number') className = 'text-yellow-500/90';
            else if (token.type === 'decorator') className = 'text-violet-400';
            else if (token.type === 'operator') className = 'text-zinc-455';
            else if (token.type === 'punctuation') className = 'text-zinc-600';
            
            return (
              <span key={i} className={className}>
                {token.value}
              </span>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

export function Docs() {
  const [activeTab, setActiveTab] = useState<'blueprint' | 'ingestion' | 'retrieval' | 'config' | 'faq'>('blueprint');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [simulating, setSimulating] = useState(false);
  
  // Faithfulness Simulator logit value
  const [logitVal, setLogitVal] = useState<number>(0.8);
  
  // Config search state
  const [paramSearch, setParamSearch] = useState('');
  const [paramFilter, setParamFilter] = useState<'all' | 'llm' | 'embedding' | 'reranker' | 'splitter' | 'pinecone'>('all');
  const [expandedParam, setExpandedParam] = useState<string | null>(null);

  // Auto-simulation interval
  useEffect(() => {
    let interval: any;
    if (simulating) {
      interval = setInterval(() => {
        setActiveStep((prev) => (prev + 1) % 7);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [simulating]);

  const configParams = [
    { name: 'llm_model', value: 'meta/llama-3.3-70b-instruct', desc: 'LLM for streaming completion generation.', type: 'String', provider: 'NVIDIA NIM', category: 'llm', envVar: 'LLM_MODEL', impact: 'Determines complete response quality, streaming speed, and reasoning capability.' },
    { name: 'embedding_model', value: 'nvidia/nv-embedqa-e5-v5', desc: 'Dense passage retrieval vectorizer.', type: 'String', provider: 'NVIDIA NIM', category: 'embedding', envVar: 'EMBEDDING_MODEL', impact: 'Sets vector space semantic matching. Ingestion and queries must share this exact model.' },
    { name: 'embedding_dimension', value: '1024', desc: 'Size of vectors generated for Pinecone.', type: 'Integer', provider: 'NVIDIA NIM', category: 'embedding', envVar: 'EMBEDDING_DIMENSION', impact: 'Matches Pinecone serverless index schema bounds.' },
    { name: 'reranker_model', value: 'nvidia/llama-3.2-nv-rerankqa-1b-v2', desc: 'Neural cross-encoder reranker.', type: 'String', provider: 'NVIDIA NIM', category: 'reranker', envVar: 'RERANKER_MODEL', impact: 'Assesses document-query pair relevance with high precision prior to generation.' },
    { name: 'max_chunk_size', value: '512 chars', desc: 'Soft limit on character count per chunk.', type: 'Integer', provider: 'Splitter', category: 'splitter', envVar: 'MAX_CHUNK_SIZE', impact: 'Controls narrative chunk bounds. Smaller sizes prevent cross-talk; larger sizes preserve context.' },
    { name: 'chunk_overlap', value: '50 chars', desc: 'Characters shared between adjacent chunks.', type: 'Integer', provider: 'Splitter', category: 'splitter', envVar: 'CHUNK_OVERLAP', impact: 'Bridges context transitions between chunks to avoid losing key information at slice edges.' },
    { name: 'top_k', value: '5', desc: 'Final context segments fed into LLM prompt.', type: 'Integer', provider: 'Pipeline', category: 'pinecone', envVar: 'RETRIEVAL_TOP_K', impact: 'Determines how many high-precision contexts are combined in the completion prompt.' },
    { name: 'candidates_multiplier', value: '4 (k=20 over-fetch)', desc: 'Pre-rerank retrieval candidate pool multiplier.', type: 'Integer', provider: 'Pipeline', category: 'pinecone', envVar: 'CANDIDATES_MULTIPLIER', impact: 'Controls the over-fetch width for initial HNSW query before reranking filtering.' },
    { name: 'min_score_threshold', value: '0.3', desc: 'Filter out context chunks below this Pinecone similarity.', type: 'Float', provider: 'Pinecone', category: 'pinecone', envVar: 'MIN_SCORE_THRESHOLD', impact: 'Cuts off matches with poor semantic relation. Prevents low-quality chunks from polluting prompts.' },
  ];

  const codeSnippets = {
    splitter: `class RecursiveTextSplitter:
    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\\n\\n", "\\n", ". ", "? ", "! ", " ", ""]

    def split_text(self, text: str) -> List[str]:
        # Splits recursively down the separator list to keep structural boundaries
        # overlapping blocks are constructed to preserve narrative continuity.
        return self._recursive_split(text, self.separators)`,
    
    rerank: `# 1. Over-fetch raw matches from Pinecone Index
raw_matches = pinecone_service.query(vector=query_vector, top_k=top_k * multiplier)

# 2. Re-score candidates using Cross-Encoder Reranker
sources = reranker_service.rerank(
    question=question, 
    candidates=candidates, 
    top_k=top_k
)`,

    faithfulness: `def _faithfulness(sources: List[Dict]) -> Optional[float]:
    """
    Proxy faithfulness score: sigmoid(mean rerank logit across returned sources).
    Range 0-1. Higher = sources were more relevant to the question.
    """
    logits = [s.get("rerank_score") for s in sources if s.get("rerank_score") is not None]
    if not logits:
        return None
    mean_logit = sum(logits) / len(logits)
    return round(1.0 / (1.0 + math.exp(-mean_logit)), 4)`
  };

  const pipelineSteps = [
    {
      title: "Document Payload Ingested",
      desc: "User uploads PDF, Word, or text file. The document is uploaded to local folder storage (/uploads) or remote AWS S3 and registered as 'pending' in the relational database.",
      icon: FileText,
      badge: "Stage 0: Download",
      service: "Storage Layer",
      engine: "Local / AWS S3 Async"
    },
    {
      title: "Structure-Aware Text Extraction",
      desc: "The system reads raw bytes and extracts layout-aware clean text. PDF parsing uses pdfplumber & pymupdf, Word files use python-docx. Scanned images run through OCR with pytesseract & Pillow.",
      icon: Terminal,
      badge: "Stage 1: Parse",
      service: "Parsing Core",
      engine: "pdfplumber + pytesseract"
    },
    {
      title: "Recursive Text Splitting",
      desc: "Text is split recursively using separators [\\n\\n, \\n, sentence dots, spaces] to stay under max_chunk_size (512 chars) with chunk_overlap (50 chars), maintaining structural continuity.",
      icon: Layers,
      badge: "Stage 2: Chunk",
      service: "Splitter Engine",
      engine: "RecursiveTextSplitter"
    },
    {
      title: "NVIDIA Neural Embedding",
      desc: "Text chunks are batched (size=16) and dispatched to the NVIDIA NIM Embedding API (nvidia/nv-embedqa-e5-v5). It yields dense 1024-dimensional vectors representing semantic content.",
      icon: Cpu,
      badge: "Stage 3: Embed",
      service: "Inference Service",
      engine: "nvidia/nv-embedqa-e5-v5"
    },
    {
      title: "Pinecone Vector Sync",
      desc: "Embeddings are sent alongside rich metadata (original filename, document ID, chunk index, char boundaries, boundary type, text preview) to a Pinecone serverless index with cosine metrics.",
      icon: Database,
      badge: "Stage 4: Upsert",
      service: "Vector Registry",
      engine: "Pinecone Serverless"
    },
    {
      title: "RAG Retrieval & Rerank Query",
      desc: "A user query is vectorized via e5-v5. Pinecone performs HNSW search to fetch 20 candidate vectors (top_k * 4). NVIDIA Reranker (llama-3.2-1b) re-scores them to fetch top 5.",
      icon: Activity,
      badge: "Stage 5: Query",
      service: "Retrieval Pipeline",
      engine: "llama-3.2-nv-rerankqa-1b"
    },
    {
      title: "Augmented Generation & Evaluation",
      desc: "Re-ordered context chunks are formatted into a prompt. meta/llama-3.3-70b streams the response. A proxy faithfulness rating is calculated using the sigmoid of rerank scores.",
      icon: Workflow,
      badge: "Stage 6: Generate",
      service: "Completion Hub",
      engine: "meta/llama-3.3-70b-instruct"
    }
  ];

  const stepLogs: Record<number, string[]> = {
    0: [
      `[INFO] Payload upload handler spawned.`,
      `[DEBUG] File type validation: application/pdf (2.45 MB)`,
      `[INFO] Writing stream asynchronously to disk / remote pool...`,
      `[SUCCESS] File registered under UUID 'doc_9b1deb4d' as PENDING.`
    ],
    1: [
      `[INFO] Initializing structure extraction route for doc_9b1deb4d.`,
      `[DEBUG] Mapping parse engines: pdfplumber -> primary, pymupdf -> fallback.`,
      `[INFO] Extracted 18 structural text segments. Processing OCR layers.`,
      `[SUCCESS] Extraction complete. Total characters: 42,301. Queue split.`
    ],
    2: [
      `[INFO] Executing chunking sequence via RecursiveTextSplitter.`,
      `[DEBUG] Sep-array hierarchy: [\\n\\n, \\n, sentence_dots, spaces].`,
      `[INFO] Settings: max_chunk_size=512, chunk_overlap=50.`,
      `[SUCCESS] Created 54 semantic text blocks. Average chunk size: 412 chars.`
    ],
    3: [
      `[INFO] Dispatching 54 text chunks to embedding pool (batch_size=16).`,
      `[INFO] Calling NVIDIA NIM: nv-embedqa-e5-v5...`,
      `[DEBUG] Latency: 120ms (parallel dispatch). Status: 200 OK.`,
      `[SUCCESS] Generated 54 embeddings with vector length 1024.`
    ],
    4: [
      `[INFO] Mounting vector upsert stream to Pinecone Serverless (us-east-1).`,
      `[DEBUG] Mapping envelope metadata schemas: {doc_id, original_name, text_preview}.`,
      `[INFO] Writing 54 items in vector sync batches.`,
      `[SUCCESS] Sync verified. Index status: READY. Cosine similarity metrics updated.`
    ],
    5: [
      `[INFO] Received user question: "What is the total quarterly revenue?"`,
      `[INFO] Query vectorization complete (nv-embedqa-e5-v5).`,
      `[DEBUG] Cosine query fetched 20 initial matches (K = top_k * 4).`,
      `[INFO] Forwarding candidate pool to Cross-Encoder reranker...`,
      `[SUCCESS] Selected top 5 Precision candidates. Rerank latency: 85ms.`
    ],
    6: [
      `[INFO] Formatting prompt templates. Candidate context payload injected (2,450 chars).`,
      `[INFO] Initializing streaming request to Llama-3.3-70b-instruct.`,
      `[DEBUG] Token streaming active. Mean throughput: 65 tokens/sec.`,
      `[SUCCESS] Stream finalized. Sigmoid faithfulness evaluation: 0.8921 (Passed).`
    ]
  };

  // Math variables for Faithfulness simulator
  const expVal = Math.exp(-logitVal);
  const denomVal = 1 + expVal;
  const faithfulnessScore = 1 / denomVal;

  const filteredParams = useMemo(() => {
    return configParams.filter(param => {
      const matchesSearch = param.name.toLowerCase().includes(paramSearch.toLowerCase()) ||
                            param.desc.toLowerCase().includes(paramSearch.toLowerCase()) ||
                            param.envVar.toLowerCase().includes(paramSearch.toLowerCase()) ||
                            param.provider.toLowerCase().includes(paramSearch.toLowerCase());
      
      const matchesFilter = paramFilter === 'all' || param.category === paramFilter;
      return matchesSearch && matchesFilter;
    });
  }, [paramSearch, paramFilter]);

  const dbModels = [
    {
      name: 'Document',
      description: 'Main table tracking document entities, parsing statuses, and S3 file references.',
      fields: [
        { name: 'id', type: 'Integer', key: 'Primary Key', desc: 'Unique autoincrement ID.' },
        { name: 'original_name', type: 'String(255)', key: 'NOT NULL', desc: 'Name of the uploaded file.' },
        { name: 'file_type', type: 'String(100)', key: 'NOT NULL', desc: 'MIME type of the source payload.' },
        { name: 's3_key', type: 'String(500)', key: 'NULLABLE', desc: 'Object path in S3 or local directory.' },
        { name: 'status', type: 'Enum', key: "'pending', 'parsing', 'ready', 'error'", desc: 'Ingestion pipeline state.' },
        { name: 'chunk_count', type: 'Integer', key: 'DEFAULT 0', desc: 'Total chunks extracted and stored.' },
        { name: 'created_at', type: 'DateTime', key: 'DEFAULT NOW', desc: 'Timestamp of upload.' }
      ]
    },
    {
      name: 'IngestionMetrics',
      description: 'Audit database holding latency benchmarks for every step of document chunking.',
      fields: [
        { name: 'id', type: 'Integer', key: 'Primary Key', desc: 'Unique record index.' },
        { name: 'document_id', type: 'Integer', key: 'FOREIGN KEY', desc: 'Relational link to Document.id.' },
        { name: 'download_ms', type: 'Integer', key: 'NULLABLE', desc: 'S3/local write latency.' },
        { name: 'parse_ms', type: 'Integer', key: 'NULLABLE', desc: 'Text parsing execution duration.' },
        { name: 'chunk_ms', type: 'Integer', key: 'NULLABLE', desc: 'Recursive split computation time.' },
        { name: 'embed_ms', type: 'Integer', key: 'NULLABLE', desc: 'NVIDIA Embedding NIM latency.' },
        { name: 'store_ms', type: 'Integer', key: 'NULLABLE', desc: 'Pinecone API synchronization time.' },
        { name: 'total_ms', type: 'Integer', key: 'NOT NULL', desc: 'Sum total ingestion duration.' }
      ]
    },
    {
      name: 'QueryMetrics',
      description: 'History logs monitoring queries, streamed responses, and precision scores.',
      fields: [
        { name: 'query_id', type: 'String(36)', key: 'Primary Key', desc: 'UUID identifier.' },
        { name: 'question', type: 'Text', key: 'NOT NULL', desc: 'User query input.' },
        { name: 'answer', type: 'Text', key: 'NOT NULL', desc: 'Streamed LLM completion output.' },
        { name: 'sources', type: 'JSON', key: 'NULLABLE', desc: 'Reference chunk mappings.' },
        { name: 'prompt_tokens', type: 'Integer', key: 'NULLABLE', desc: 'Input token count.' },
        { name: 'completion_tokens', type: 'Integer', key: 'NULLABLE', desc: 'Output token count.' },
        { name: 'faithfulness_score', type: 'Float', key: 'NULLABLE', desc: 'Sigmoid evaluation rating.' },
        { name: 'created_at', type: 'DateTime', key: 'DEFAULT NOW', desc: 'Query timestamp.' }
      ]
    }
  ];

  return (
    <div className="px-6 py-8 mx-auto w-full max-w-[1600px] font-sans text-zinc-200 relative leading-relaxed antialiased">
      {/* Visual Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-orange-500/3 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[30vh] right-1/4 w-[600px] h-[600px] bg-blue-500/2 rounded-full blur-[140px] pointer-events-none -z-10" />
      
      <div className="space-y-8">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-8 backdrop-blur-md shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              <h1 className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-zinc-450">
                System Core Specs
              </h1>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Production RAG System Architecture
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed">
              Technical documentation, active parameters, schemas, and live simulator for our dual-stage retrieval augmented completion pipeline.
            </p>
          </div>

          {/* Quick specs grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 shrink-0">
            <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-zinc-900 bg-black/60 shadow-inner">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">LLM Engine</span>
              <span className="text-xs font-bold text-orange-400 font-mono flex items-center gap-1.5 mt-1">
                <Cpu size={12} className="text-orange-500 shrink-0" />
                Llama-3.3-70B NIM
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-zinc-900 bg-black/60 shadow-inner">
              <span className="text-[10px] font-mono text-zinc-550 uppercase tracking-wider font-semibold">Vector Index</span>
              <span className="text-xs font-bold text-blue-400 font-mono flex items-center gap-1.5 mt-1">
                <Database size={12} className="text-blue-500 shrink-0" />
                Pinecone Server
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-zinc-900 bg-black/60 col-span-2 sm:col-span-1 shadow-inner">
              <span className="text-[10px] font-mono text-zinc-550 uppercase tracking-wider font-semibold">Vector Size</span>
              <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5 mt-1">
                <Activity size={12} className="text-emerald-500 shrink-0" />
                1024 Dimensions
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800/80 pb-px gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'blueprint', label: 'Architecture Blueprint', icon: Workflow },
            { id: 'ingestion', label: 'Ingestion Layer', icon: Layers },
            { id: 'retrieval', label: 'Retrieval & Rerank', icon: Cpu },
            { id: 'config', label: 'Active Parameters', icon: Sliders },
            { id: 'faq', label: 'RAG Q&A', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  "relative flex items-center gap-2 px-5 py-3 text-sm font-sans font-semibold transition-all border-b-2 -mb-px cursor-pointer whitespace-nowrap outline-none",
                  active 
                    ? "border-orange-500 text-white bg-zinc-900/10" 
                    : "border-transparent text-zinc-450 hover:text-zinc-200 hover:bg-zinc-900/5"
                )}
              >
                <Icon size={14} className={clsx(active ? "text-orange-500" : "text-zinc-500")} />
                {tab.label}
                {active && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Panel Contents */}
        <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              
              {/* TAB 1: ARCHITECTURE BLUEPRINT */}
              {activeTab === 'blueprint' && (
                <div className="space-y-8">
                  {/* Interactive Diagram Card */}
                  <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl relative overflow-hidden space-y-6">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/2 rounded-full blur-[80px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/2 rounded-full blur-[80px] pointer-events-none" />
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                      <div>
                        <h3 className="text-xs font-mono font-bold tracking-widest text-orange-500 uppercase">
                          Pipeline Simulator
                        </h3>
                        <h4 className="text-base font-bold text-white mt-1">
                          Interactive RAG Dataflow Node Map
                        </h4>
                      </div>
                      
                      {/* Sim Control Button */}
                      <button
                        onClick={() => setSimulating(prev => !prev)}
                        className={clsx(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer select-none",
                          simulating 
                            ? "border-orange-500/30 bg-orange-950/20 text-orange-400 hover:bg-orange-950/30 shadow-[0_0_15px_rgba(244,131,31,0.15)]"
                            : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white"
                        )}
                      >
                        {simulating ? (
                          <>
                            <Pause size={12} className="animate-pulse" />
                            <span>PAUSE SIMULATION</span>
                          </>
                        ) : (
                          <>
                            <Play size={12} />
                            <span>RUN SIMULATION</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Nodes Connector Area */}
                    <div className="relative py-8 px-4 overflow-x-auto no-scrollbar">
                      {/* Visual Line Connectors */}
                      <div className="absolute top-[48px] left-[5%] right-[5%] h-0.5 bg-zinc-800 z-0 hidden md:block">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 via-blue-500 to-emerald-500 transition-all duration-500 ease-out"
                          style={{ width: `${(activeStep / 6) * 100}%` }}
                        />
                      </div>

                      {/* Flex grid containing pipeline nodes */}
                      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center justify-between relative z-10 min-w-[700px] md:min-w-0">
                        {pipelineSteps.map((step, idx) => {
                          const StepIcon = step.icon;
                          const isActive = activeStep === idx;
                          const isPassed = idx < activeStep;
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setSimulating(false);
                                setActiveStep(idx);
                              }}
                              className="focus:outline-none flex flex-row md:flex-col items-center gap-3 md:gap-3 text-left md:text-center w-full md:w-28 cursor-pointer group"
                            >
                              {/* Node Circle */}
                              <div className={clsx(
                                "w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-300 relative shrink-0",
                                isActive 
                                  ? "bg-orange-500 border-orange-400 text-black shadow-[0_0_20px_rgba(244,131,31,0.4)]"
                                  : isPassed 
                                    ? "bg-[#09090b] border-emerald-500/60 text-emerald-400"
                                    : "bg-[#0c0c0f] border-zinc-800 text-zinc-550 group-hover:border-zinc-700 group-hover:text-zinc-350"
                              )}>
                                <StepIcon size={16} />
                                
                                {/* Pulse Effect rings for active step */}
                                {isActive && (
                                  <span className="absolute -inset-1 rounded-2xl border border-orange-500/50 animate-ping opacity-70 pointer-events-none" />
                                )}
                              </div>
                              
                              {/* Step Info */}
                              <div className="space-y-0.5">
                                <span className={clsx(
                                  "font-mono text-[9px] block tracking-wider",
                                  isActive ? "text-orange-400 font-bold" : "text-zinc-600"
                                )}>
                                  STAGE 0{idx}
                                </span>
                                <span className={clsx(
                                  "text-[11px] font-sans font-bold tracking-tight block transition-colors duration-200 truncate max-w-[120px] md:max-w-none",
                                  isActive ? "text-white" : isPassed ? "text-zinc-400" : "text-zinc-500 group-hover:text-zinc-400"
                                )}>
                                  {step.title.split(' ')[0]} {step.title.split(' ')[1] || ''}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stage Details Drawer */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-stretch pt-4 border-t border-zinc-800">
                      {/* Left: Prose details */}
                      <div className="rounded-xl border border-zinc-800 bg-black/40 p-5 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[9px] bg-orange-950/50 border border-orange-800/40 text-orange-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                              {pipelineSteps[activeStep].badge}
                            </span>
                            <span className="font-mono text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                              {pipelineSteps[activeStep].service}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-white font-sans">
                            {pipelineSteps[activeStep].title}
                          </h4>
                          <p className="text-zinc-400 text-sm leading-relaxed font-sans">
                            {pipelineSteps[activeStep].desc}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-2 text-[10px] text-zinc-500 font-mono border-t border-zinc-900/60">
                          <span>Active Engine:</span>
                          <span className="text-zinc-300 font-bold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                            {pipelineSteps[activeStep].engine}
                          </span>
                        </div>
                      </div>

                      {/* Right: Live log output terminal */}
                      <div className="rounded-xl border border-zinc-800 bg-black/90 p-4 font-mono text-[10px] flex flex-col justify-between h-[160px] lg:h-auto shadow-inner relative">
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">Telemetry Live Feed</span>
                        </div>
                        <div className="space-y-1.5 overflow-y-auto pr-2 max-h-[140px] text-zinc-400">
                          {stepLogs[activeStep].map((log, index) => {
                            const isSuccess = log.includes('SUCCESS');
                            const isDebug = log.includes('DEBUG');
                            return (
                              <div key={index} className={clsx(
                                "leading-relaxed border-l-2 pl-2",
                                isSuccess ? "text-emerald-400 border-emerald-500/80" : isDebug ? "text-zinc-500 border-zinc-700" : "text-zinc-350 border-orange-500/60"
                              )}>
                                {log}
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[8px] text-zinc-600 border-t border-zinc-900 pt-2 flex justify-between items-center mt-3">
                          <span>CONSOLE // READY</span>
                          <span>SYS_TIME: {new Date().toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bento Grid: Architectural Pillars */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* FastAPI sqlite */}
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-5 backdrop-blur-md hover:border-zinc-700 transition-all duration-300 space-y-4 shadow-xl group">
                      <div className="h-9 w-9 rounded-xl bg-orange-950/40 border border-orange-850 flex items-center justify-center text-orange-500 group-hover:shadow-[0_0_12px_rgba(244,131,31,0.15)] transition-shadow">
                        <Server size={16} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-white font-sans">
                          FastAPI & SQLite Core
                        </h4>
                        <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                          Uvicorn drives an asynchronous API backend. Status tracking and latency metrics are logged directly into SQLite schemas via SQLAlchemy.
                        </p>
                      </div>
                      <div className="border-t border-zinc-900 pt-3 flex items-center justify-between text-[9px] text-zinc-550 font-mono">
                        <span>LATENCY AVG</span>
                        <span className="text-orange-400 font-bold">12ms - 45ms</span>
                      </div>
                    </div>

                    {/* Over-fetch Rerank */}
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-5 backdrop-blur-md hover:border-zinc-700 transition-all duration-300 space-y-4 shadow-xl group">
                      <div className="h-9 w-9 rounded-xl bg-blue-950/40 border border-blue-850 flex items-center justify-center text-blue-500 group-hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition-shadow">
                        <SlidersHorizontal size={16} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-white font-sans">
                          Multi-Stage Reranking
                        </h4>
                        <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                          Resolves vector semantic retrieval gaps. Over-fetches candidate pools (K=20), then re-scores precision down to Top-5 contexts via a neural Cross-Encoder.
                        </p>
                      </div>
                      <div className="border-t border-zinc-900 pt-3 flex items-center justify-between text-[9px] text-zinc-550 font-mono">
                        <span>RECALL RATIO</span>
                        <span className="text-blue-400 font-bold">+92.4% Precision</span>
                      </div>
                    </div>

                    {/* WebSocket telemetry */}
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-5 backdrop-blur-md hover:border-zinc-700 transition-all duration-300 space-y-4 shadow-xl group">
                      <div className="h-9 w-9 rounded-xl bg-emerald-950/40 border border-emerald-850 flex items-center justify-center text-emerald-500 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-shadow">
                        <Activity size={16} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-white font-sans">
                          Reactive Telemetry
                        </h4>
                        <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                          Maintains active streams. Ingestion logs and metrics are broadcasted to the client dynamically via WebSockets, rendering status tables in real-time.
                        </p>
                      </div>
                      <div className="border-t border-zinc-900 pt-3 flex items-center justify-between text-[9px] text-zinc-550 font-mono">
                        <span>TELEMETRY SYNC</span>
                        <span className="text-emerald-400 font-bold">Real-time / WebSocket</span>
                      </div>
                    </div>
                  </div>

                  {/* Flow chart layout block */}
                  <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl space-y-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono font-bold tracking-widest text-orange-500 uppercase">
                        Architecture Flow Mapping
                      </h4>
                      <span className="text-[9px] text-zinc-500 font-mono">END-TO-END DATA PIPELINE LAYERS</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                      {/* 1. Ingestion */}
                      <div className="p-5 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-3 relative group hover:border-zinc-700 transition-colors">
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-zinc-800 hidden md:block animate-pulse">
                          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          1. Ingestion Pipeline
                        </h4>
                        <ul className="space-y-2 text-xs text-zinc-450 font-sans leading-relaxed">
                          <li className="flex items-start gap-1.5">&bull; <span>Read and extract raw file bytes (S3/local)</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>OCR layer parsing for scans (pytesseract)</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Recursive structural split (512 limit)</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Generate 1024d vectors via NVIDIA NIM</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Upsert embeddings alongside metadata envelope</span></li>
                        </ul>
                      </div>

                      {/* 2. Retrieval */}
                      <div className="p-5 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-3 relative group hover:border-zinc-700 transition-colors">
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-zinc-800 hidden md:block animate-pulse">
                          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          2. Retrieval Layer
                        </h4>
                        <ul className="space-y-2 text-xs text-zinc-450 font-sans leading-relaxed">
                          <li className="flex items-start gap-1.5">&bull; <span>Convert incoming query to 1024d embedding</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>HNSW Cosine query in Pinecone (K=20)</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Filter out similarities below threshold (0.3)</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Rerank candidates using Cross-Encoder NIM</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Feed Top-5 high-precision matches to Prompt</span></li>
                        </ul>
                      </div>

                      {/* 3. Completion */}
                      <div className="p-5 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-3 hover:border-zinc-700 transition-colors">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          3. Generation Core
                        </h4>
                        <ul className="space-y-2 text-xs text-zinc-450 font-sans leading-relaxed">
                          <li className="flex items-start gap-1.5">&bull; <span>Format system templates with context chunks</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Dispatch request to Llama-3.3-70b-instruct</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Stream completion tokens via Server-Sent Events</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Evaluate Rerank score Sigmoid faithfulness</span></li>
                          <li className="flex items-start gap-1.5">&bull; <span>Persist latency audit traces in SQL database</span></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INGESTION LAYER */}
              {activeTab === 'ingestion' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-8 items-start">
                  {/* Left Column: Descriptive prose */}
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl space-y-5">
                      <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                        <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                          Ingestion Protocols
                        </h3>
                      </div>
                      
                      <div className="space-y-5 text-sm leading-relaxed text-zinc-350">
                        <div className="space-y-2 font-sans">
                          <h4 className="text-white font-bold text-sm flex items-center gap-1.5">
                            <span className="text-orange-500 font-mono">01 /</span>
                            Content Extraction Engine
                          </h4>
                          <p className="text-zinc-455">
                            Raw file bytes uploaded to storage are analyzed and parsed inside <code className="text-orange-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 font-mono font-semibold">app/utils/file_parsers.py</code>:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div className="p-3 rounded-xl border border-zinc-800 bg-black/40">
                              <span className="text-white font-bold block text-[11px] font-sans">PDF Layouts</span>
                              <span className="text-zinc-500 mt-1 block text-xs">pdfplumber (tables & formatting)</span>
                            </div>
                            <div className="p-3 rounded-xl border border-zinc-800 bg-black/40">
                              <span className="text-white font-bold block text-[11px] font-sans">Word Docs</span>
                              <span className="text-zinc-500 mt-1 block text-xs">python-docx parser</span>
                            </div>
                            <div className="p-3 rounded-xl border border-zinc-800 bg-black/40">
                              <span className="text-white font-bold block text-[11px] font-sans">Scanned Image</span>
                              <span className="text-zinc-500 mt-1 block text-xs">pytesseract OCR engine</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 font-sans">
                          <h4 className="text-white font-bold text-sm flex items-center gap-1.5">
                            <span className="text-orange-500 font-mono">02 /</span>
                            Recursive Semantic Chunking
                          </h4>
                          <p className="text-zinc-455">
                            Splits text based on paragraph boundaries, sentences, and words rather than strict character counts. This guarantees that each chunk holds a complete semantic context.
                          </p>
                          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900 flex items-start gap-3">
                            <Sliders size={14} className="text-orange-500 shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <span className="text-zinc-300 font-bold block font-sans">Settings Matrix</span>
                              <span className="text-zinc-500 mt-0.5 block leading-normal">chunk_size = 512 chars (approx. 80-100 words)<br />chunk_overlap = 50 chars (prevents loss of sentence-edge context)</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 font-sans">
                          <h4 className="text-white font-bold text-sm flex items-center gap-1.5">
                            <span className="text-orange-500 font-mono">03 /</span>
                            NVIDIA NIM Embedding Sync
                          </h4>
                          <p className="text-zinc-455">
                            Dispatches chunk arrays to the <code className="text-orange-400 font-semibold font-mono">nvidia/nv-embedqa-e5-v5</code> endpoint. The model encodes texts into dense 1024d float arrays. Vectors are stored in Pinecone serverless containing metadata envelopes for lookup.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Schema Box */}
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                        <h4 className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                          <Database size={13} className="text-blue-500" />
                          Pinecone Metadata Envelope
                        </h4>
                        <span className="text-[8px] font-mono text-zinc-550 uppercase">Schema Layout</span>
                      </div>
                      
                      <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 font-mono text-[11px] text-zinc-400 overflow-x-auto whitespace-pre">
{`{
  "doc_id": "doc_9b1deb4d",
  "original_name": "annual_financial_report_2025.pdf",
  "file_type": "application/pdf",
  "chunk_index": 12,
  "char_start": 6144,
  "char_end": 6656,
  "text": "Operating cash flow for the fourth quarter was $1.2B..."
}`}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Code block demonstrating custom splitter */}
                  <div className="space-y-6">
                    <CodeBlock 
                      code={codeSnippets.splitter} 
                      filename="app/utils/chunking.py" 
                      language="python" 
                    />

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 flex items-start gap-3 font-sans text-xs text-zinc-450 leading-relaxed">
                      <Info size={16} className="text-orange-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-zinc-300">Splitting Edge Case:</strong> If the text does not contain any of the registered separators, the algorithm splits the text at exactly <code className="text-orange-400 font-mono">chunk_size</code> characters to ensure the pipeline doesn't overflow.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: RETRIEVAL & RERANK */}
              {activeTab === 'retrieval' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-8 items-start">
                  
                  {/* Left Column: Retrieval Explanation */}
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl space-y-5">
                      <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                          Retrieval Architecture
                        </h3>
                      </div>

                      <div className="space-y-4 text-sm leading-relaxed text-zinc-350">
                        <div className="space-y-1 font-sans">
                          <h4 className="text-white font-bold text-sm">
                            Stage 1: HNSW Dense Retrieval
                          </h4>
                          <p className="text-zinc-455">
                            User queries are converted into 1024d embedding vectors. Pinecone processes cosine distance metrics against document vectors. We over-fetch using a multiplier of 4 (<code className="text-blue-400 font-mono">K = 20</code>) to capture complex semantic scopes.
                          </p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <h4 className="text-white font-bold text-sm">
                            Stage 2: Cross-Encoder Reranking
                          </h4>
                          <p className="text-zinc-455">
                            The candidate vector array is re-scored alongside the query using <code className="text-blue-400 font-mono">nvidia/llama-3.2-nv-rerankqa-1b-v2</code>. Unlike dual-encoders, Cross-Encoders evaluate text-query tokens simultaneously, scoring exact relevance and discarding false matches.
                          </p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <h4 className="text-white font-bold text-sm">
                            Stage 3: Proxy Faithfulness Score
                          </h4>
                          <p className="text-zinc-455">
                            RAG systems can hallucinate if contexts are weakly related to the query. We evaluate this by calculating the sigmoid of the average logit score output by the reranker: <code className="text-emerald-400 font-semibold font-mono">sigmoid(mean_logit)</code>.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Faithfulness Simulator */}
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl space-y-5">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                        <div>
                          <h4 className="text-xs font-mono font-bold text-white">
                            Faithfulness Calculator
                          </h4>
                          <span className="text-[9px] font-mono text-zinc-550">Interactive Mathematical Sim</span>
                        </div>
                        <span className="text-[8px] font-mono text-zinc-600 uppercase">Live Model</span>
                      </div>

                      {/* Slider Input */}
                      <div className="space-y-3 font-sans">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-zinc-400">Reranker Logit (x)</span>
                          <span className="text-orange-400 font-mono font-bold">{logitVal.toFixed(1)}</span>
                        </div>
                        <input 
                          type="range" 
                          min="-3.0" 
                          max="3.0" 
                          step="0.1" 
                          value={logitVal} 
                          onChange={(e) => setLogitVal(parseFloat(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500 animate-pulse-slow"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                          <span>-3.0 (Irrelevant)</span>
                          <span>0.0 (Neutral)</span>
                          <span>3.0 (Perfect Match)</span>
                        </div>
                      </div>

                      {/* Formula Visual Card */}
                      <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 font-mono text-[11px] space-y-2">
                        <div className="flex justify-between">
                          <span className="text-zinc-550">Sigmoid Formula:</span>
                          <span className="text-zinc-350">1 / (1 + e^-x)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-550">e^-x component:</span>
                          <span className="text-zinc-400">{expVal.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between border-t border-zinc-900 pt-2 font-bold">
                          <span className="text-zinc-300">Calculated Score:</span>
                          <span className={clsx(
                            faithfulnessScore >= 0.8 ? "text-emerald-400" : faithfulnessScore >= 0.5 ? "text-yellow-500" : "text-red-400"
                          )}>
                            {faithfulnessScore.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      {/* Indicator Badge */}
                      <div className={clsx(
                        "p-3 rounded-xl border font-sans text-xs text-center font-bold transition-all duration-300",
                        faithfulnessScore >= 0.8 
                          ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400" 
                          : faithfulnessScore >= 0.5 
                            ? "bg-yellow-950/20 border-yellow-900/50 text-yellow-400" 
                            : "bg-red-950/20 border-red-900/50 text-red-400"
                      )}>
                        {faithfulnessScore >= 0.8 
                          ? "✓ High Faithfulness: Low Hallucination Risk" 
                          : faithfulnessScore >= 0.5 
                            ? "⚠ Moderate Faithfulness: Double check sources" 
                            : "✗ Low Faithfulness: Context is likely irrelevant"
                        }
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Code block demonstrating reranking pipeline and faithfulness math */}
                  <div className="space-y-6">
                    <CodeBlock 
                      code={codeSnippets.rerank} 
                      filename="app/pipeline/retrieval.py" 
                      language="python" 
                    />

                    <CodeBlock 
                      code={codeSnippets.faithfulness} 
                      filename="Faithfulness Evaluation Logic" 
                      language="python" 
                    />
                  </div>

                </div>
              )}

              {/* TAB 4: ACTIVE PARAMETERS */}
              {activeTab === 'config' && (
                <div className="space-y-8">
                  {/* Parameter control table panel */}
                  <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                      <div>
                        <h3 className="text-xs font-mono font-bold tracking-widest text-orange-500 uppercase">
                          Configuration Registry
                        </h3>
                        <h4 className="text-base font-bold text-white mt-1">
                          System Environment Variables
                        </h4>
                      </div>

                      {/* Search & Category Filter Box */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-550" />
                          <input 
                            type="text" 
                            placeholder="Filter configurations..."
                            value={paramSearch}
                            onChange={(e) => setParamSearch(e.target.value)}
                            className="pl-8 pr-4 py-1.5 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-550 focus:outline-none focus:border-zinc-700 w-52 font-mono"
                          />
                        </div>

                        <select
                          value={paramFilter}
                          onChange={(e) => setParamFilter(e.target.value as any)}
                          className="bg-black border border-zinc-800 rounded-xl text-xs text-zinc-400 py-1.5 px-3 focus:outline-none font-sans font-semibold cursor-pointer"
                        >
                          <option value="all">All Modules</option>
                          <option value="llm">LLM Models</option>
                          <option value="embedding">Embeddings</option>
                          <option value="reranker">Reranker</option>
                          <option value="splitter">Splitter</option>
                          <option value="pinecone">Pinecone / Pipeline</option>
                        </select>
                      </div>
                    </div>

                    {/* Params Table grid */}
                    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-black/20">
                      <table className="w-full text-left border-collapse font-sans text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-bold font-mono">
                            <th className="px-5 py-3.5 text-[9px] uppercase tracking-wider font-semibold">Parameter Key</th>
                            <th className="px-5 py-3.5 text-[9px] uppercase tracking-wider font-semibold">Component Provider</th>
                            <th className="px-5 py-3.5 text-[9px] uppercase tracking-wider font-semibold">Data Type</th>
                            <th className="px-5 py-3.5 text-[9px] uppercase tracking-wider font-semibold">Active Value</th>
                            <th className="px-5 py-3.5 text-[9px] uppercase tracking-wider font-semibold text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 text-zinc-400 bg-black/35 font-mono text-[11px] sm:text-xs">
                          {filteredParams.length > 0 ? (
                            filteredParams.map((param, index) => {
                              const isExpanded = expandedParam === param.name;
                              return (
                                <optgroup key={index} className="contents font-sans">
                                  <tr 
                                    onClick={() => setExpandedParam(isExpanded ? null : param.name)}
                                    className="hover:bg-zinc-950/80 cursor-pointer transition-colors group font-mono"
                                  >
                                    <td className="px-5 py-3.5 font-bold text-zinc-200 group-hover:text-orange-400 transition-colors">
                                      {param.name}
                                    </td>
                                    <td className="px-5 py-3.5 text-zinc-450 font-sans">{param.provider}</td>
                                    <td className="px-5 py-3.5 text-zinc-550">{param.type}</td>
                                    <td className="px-5 py-3.5 font-semibold text-orange-500/90">{param.value}</td>
                                    <td className="px-5 py-3.5 text-right font-sans">
                                      <button className="text-[10px] text-zinc-500 hover:text-zinc-350 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded transition-colors font-sans font-semibold">
                                        {isExpanded ? 'Hide' : 'Show'}
                                      </button>
                                    </td>
                                  </tr>
                                  
                                  {isExpanded && (
                                    <tr className="font-sans">
                                      <td colSpan={5} className="px-5 py-4 bg-zinc-950/80 border-t border-zinc-900">
                                        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 text-xs sm:text-sm leading-relaxed font-sans">
                                          <div className="space-y-1 border-r border-zinc-900 pr-2">
                                            <span className="text-[8px] text-zinc-500 font-mono block font-bold uppercase tracking-wider">ENV Variable</span>
                                            <span className="text-zinc-300 font-mono font-bold block overflow-x-auto select-all">{param.envVar}</span>
                                          </div>
                                          <div className="space-y-3 font-sans">
                                            <div>
                                              <span className="text-[8px] text-zinc-500 font-mono block font-bold uppercase tracking-wider">Functional Description</span>
                                              <p className="text-zinc-350 text-xs sm:text-sm mt-0.5">{param.desc}</p>
                                            </div>
                                            <div>
                                              <span className="text-[8px] text-zinc-500 font-mono block font-bold uppercase tracking-wider">Performance Impact</span>
                                              <p className="text-zinc-450 text-[11px] sm:text-xs mt-0.5">{param.impact}</p>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </optgroup>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center py-8 text-zinc-500 font-sans text-xs">
                                No parameters found matching "{paramSearch}"
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SQLite SQLAlchemy models inspector */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">
                    {/* Relational schemas */}
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl space-y-6">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div>
                          <h3 className="text-xs font-mono font-bold tracking-widest text-orange-500 uppercase">
                            Relational Database Schema
                          </h3>
                          <h4 className="text-base font-bold text-white mt-1">
                            SQLite SQLAlchemy Models
                          </h4>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">Data Models</span>
                      </div>

                      <div className="space-y-6">
                        {dbModels.map((model, idx) => (
                          <div key={idx} className="rounded-xl border border-zinc-800 bg-black/30 p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                              <span className="font-bold text-zinc-100 font-sans text-sm flex items-center gap-1.5">
                                <Database size={13} className="text-orange-500" />
                                {model.name}
                              </span>
                              <span className="text-[8px] font-mono text-zinc-550 uppercase">Table Class</span>
                            </div>
                            <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                              {model.description}
                            </p>
                            
                            {/* Table fields */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left font-mono text-[10px] sm:text-xs">
                                <thead>
                                  <tr className="text-zinc-550 border-b border-zinc-900">
                                    <th className="py-1">Field Name</th>
                                    <th className="py-1 font-sans">Type</th>
                                    <th className="py-1">Mapping Constraints</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900 text-zinc-400">
                                  {model.fields.map((f, fidx) => (
                                    <tr key={fidx} className="hover:bg-zinc-900/10">
                                      <td className="py-1.5 font-bold text-zinc-300">{f.name}</td>
                                      <td className="py-1.5 text-zinc-500 font-sans">{f.type}</td>
                                      <td className="py-1.5 text-orange-400/80 text-[10px]">{f.key}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Infrastructure layer */}
                    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl space-y-6">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div>
                          <h3 className="text-xs font-mono font-bold tracking-widest text-orange-500 uppercase">
                            Infrastructure Specs
                          </h3>
                          <h4 className="text-base font-bold text-white mt-1">
                            Hosting & Service Layer
                          </h4>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">Infrastructure</span>
                      </div>

                      <div className="space-y-4 font-sans text-xs sm:text-sm text-zinc-450 leading-relaxed">
                        <div className="p-4 rounded-xl border border-zinc-800 bg-black/40 space-y-1.5">
                          <h5 className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            NVIDIA NIM Gateway
                          </h5>
                          <p className="leading-relaxed">
                            Hosts high-performance inference APIs. Links back to <code className="text-orange-400 font-mono text-xs">integrate.api.nvidia.com/v1</code> for embedding, completions, and neural rerank steps.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl border border-zinc-800 bg-black/40 space-y-1.5">
                          <h5 className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Pinecone Serverless Index
                          </h5>
                          <p className="leading-relaxed">
                            Scales vector retrieval across AWS regions. Vector index dimension is set to 1024d using cosine metric calculations.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl border border-zinc-800 bg-black/40 space-y-1.5">
                          <h5 className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            File Storage Registry
                          </h5>
                          <p className="leading-relaxed">
                            Upload folder payload stores PDFs and DOCX files. Scans are immediately parsed and cleared from temporary disk storage to optimize file management.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 5: RAG Q&A */}
              {activeTab === 'faq' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* Title card */}
                  <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e]/80 p-6 backdrop-blur-md shadow-2xl relative overflow-hidden space-y-6">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-[80px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="border-b border-zinc-800/80 pb-5">
                      <h3 className="text-xs font-mono font-bold tracking-widest text-orange-500 uppercase">
                        RAG Implementation Q&A
                      </h3>
                      <h4 className="text-xl font-bold text-white mt-1">
                        Addressing Core Production Challenges
                      </h4>
                      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                        How we solved critical RAG failures: retaining layout structures in table parsers, avoiding information redundancy during semantic searches, and handling informal code-mixed Hinglish queries.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      
                      {/* Challenge 1 */}
                      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              CHALLENGE 1
                            </span>
                            <h4 className="text-lg font-bold text-white mt-2">
                              Structured Table Layout Preservation (Row 14, Column 3)
                            </h4>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-zinc-100">Problem:</strong> A PDF has a table where the answer sits in row 14, column 3. Normal text splitters break markdown tables across arbitrary character boundaries, severing row 14 from the column headers. During retrieval, individual cells are matched but their column context is completely lost, causing RAG model response failure.
                          </p>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-emerald-400">Solution:</strong> We implemented the <code className="text-xs font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded">TableAwareSplitter</code> class. It extracts markdown tables as distinct, atomic blocks. If a table exceeds the target chunk size, the splitter cuts it row-by-row and injects the column headers (first two lines) at the top of every row chunk.
                          </p>
                        </div>
                        <div className="border-t border-zinc-800/50 pt-3">
                          <span className="text-xs font-mono text-zinc-500">
                            Source code: <code className="text-zinc-400">backend/app/pipeline/table_splitter.py</code> &bull; Integrated in <code className="text-zinc-400">ingestion.py</code>
                          </span>
                        </div>
                      </div>

                      {/* Challenge 2 */}
                      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              CHALLENGE 2
                            </span>
                            <h4 className="text-lg font-bold text-white mt-2">
                              Retrieval Diversity & Coverage (Avoiding Redundant Top-K)
                            </h4>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-zinc-100">Problem:</strong> Retrieval queries frequently return 5 text chunks that say the same thing (redundancy). The model looks highly confident because the candidates all match semantic keyword queries, but they have no real coverage of other sections that might answer different aspects of the user's question.
                          </p>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-emerald-400">Solution:</strong> We implemented the <code className="text-xs font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded">MaximalMarginalRelevanceFilter</code> (MMR) service. We query Pinecone with <code className="text-xs font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded">include_values=True</code> to fetch candidate vector embeddings, then select the top-N diverse chunks by maximizing relevance minus max redundancy with already selected chunks.
                          </p>
                        </div>
                        <div className="border-t border-zinc-800/50 pt-3">
                          <span className="text-xs font-mono text-zinc-500">
                            Source code: <code className="text-zinc-400">backend/app/services/diversity_filter.py</code> &bull; Integrated in <code className="text-zinc-400">retrieval.py</code>
                          </span>
                        </div>
                      </div>

                      {/* Challenge 3 */}
                      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              CHALLENGE 3
                            </span>
                            <h4 className="text-lg font-bold text-white mt-2">
                              Code-Mixed Query Translation (Hinglish Support)
                            </h4>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-zinc-100">Problem:</strong> Users ask questions in casual Hindi-English (Hinglish, e.g. *"kitna refund milega for cancelled order"*), while documents are in formal English. Monolingual semantic search fails because embeddings do not match across distinct languages and styles.
                          </p>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-emerald-400">Solution:</strong> We implemented the <code className="text-xs font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded">QueryTranslator</code> service. Raw input queries are routed through a fast, deterministic LLM translation step (using Llama-3.3-70b at temperature 0.0) to rewrite Hinglish into formal English before embedding and vector search.
                          </p>
                        </div>
                        <div className="border-t border-zinc-800/50 pt-3">
                          <span className="text-xs font-mono text-zinc-500">
                            Source code: <code className="text-zinc-400">backend/app/services/query_translator.py</code> &bull; Integrated in <code className="text-zinc-400">retrieval.py</code>
                          </span>
                        </div>
                      </div>

                      {/* Challenge 4 */}
                      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              CHALLENGE 4
                            </span>
                            <h4 className="text-lg font-bold text-white mt-2">
                              Multi-Document Reasoning (Connecting Dispersed Facts)
                            </h4>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-zinc-100">Problem:</strong> Standard RAG embeds a complex query into a single vector. If the query requires information from multiple documents (e.g., *"Compare Q1 and Q2 sales"*), standard retrieval retrieves chunks matching the hybrid vector, often completely missing one of the parts.
                          </p>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-emerald-400">Solution:</strong> We introduced a <code className="text-xs font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded">QueryDecomposer</code> service that uses a fast LLM call to break down complex queries into a list of simpler, independent sub-queries. The system retrieves candidate pools for each sub-query in parallel and merges them.
                          </p>
                        </div>
                        <div className="border-t border-zinc-800/50 pt-3">
                          <span className="text-xs font-mono text-zinc-500">
                            Source code: <code className="text-zinc-400">backend/app/services/query_decomposer.py</code> &bull; Integrated in <code className="text-zinc-400">retrieval.py</code>
                          </span>
                        </div>
                      </div>

                      {/* Challenge 5 */}
                      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              CHALLENGE 5
                            </span>
                            <h4 className="text-lg font-bold text-white mt-2">
                              Retrieval of Deep Chunks (e.g. Chunk #12) without Context Flooding
                            </h4>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-zinc-100">Problem:</strong> If a chunk is ranked 12th in raw vector search, increasing <code className="text-xs font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded">top_k</code> to 20 or 30 retrieves it but floods the LLM context window.
                          </p>
                          <div className="space-y-2">
                            <p className="text-sm text-zinc-300 leading-relaxed">
                              <strong className="text-emerald-400">Solution:</strong> We solve this using a multi-stage approach:
                            </p>
                            <ol className="list-decimal list-inside ml-2 space-y-1 text-sm text-zinc-300">
                              <li>We retrieve a larger candidate pool (e.g. 20-30 chunks).</li>
                              <li>We bypass diversity filters (like MMR) before reranking because they can prematurely prune the correct chunk. Instead, we run the Cross-Encoder Reranker directly on all candidates, as sequence-level attention is highly precise at ranking the exact match to the top.</li>
                              <li>We apply a <code className="text-xs font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded">ContextCompressor</code> to split the top reranked chunks into sentences, retaining only sentences matching key queries/keywords. This compresses chunks by 50-70% (removing irrelevant filler), allowing the LLM to process more sources without exceeding token limits.</li>
                            </ol>
                          </div>
                        </div>
                        <div className="border-t border-zinc-800/50 pt-3">
                          <span className="text-xs font-mono text-zinc-500">
                            Source code: <code className="text-zinc-400">backend/app/services/context_compressor.py</code> &bull; Integrated in <code className="text-zinc-400">retrieval.py</code>
                          </span>
                        </div>
                      </div>

                      {/* Challenge 6 */}
                      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              CHALLENGE 6
                            </span>
                            <h4 className="text-lg font-bold text-white mt-2">
                              Dynamic 5-Minute Live Updates
                            </h4>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            <strong className="text-zinc-100">Problem:</strong> Under a fast update loop, simple inserts lead to duplicate or stale chunks showing up in search results.
                          </p>
                          <div className="space-y-2">
                            <p className="text-sm text-zinc-300 leading-relaxed">
                              <strong className="text-emerald-400">Solution:</strong> We implemented a multi-layered consistency pattern:
                            </p>
                            <ol className="list-decimal list-inside ml-2 space-y-1 text-sm text-zinc-300">
                              <li><strong>Idempotence & Active Purging:</strong> When a document with an existing name is uploaded, we actively purge its old vectors from Pinecone and its local/S3 files first, preventing duplicate or stale index items.</li>
                              <li><strong>DB-Backed State Reconciliation:</strong> When a query retrieves chunks from vector search, we check the retrieved document IDs against the relational SQL database. Chunks belonging to documents that are deleted, orphaned, or not yet marked <code className="text-xs font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded">ready</code> are dynamically filtered out.</li>
                            </ol>
                          </div>
                        </div>
                        <div className="border-t border-zinc-800/50 pt-3">
                          <span className="text-xs font-mono text-zinc-500">
                            Source code: <code className="text-zinc-400">backend/app/main.py</code> &bull; Integrated in <code className="text-zinc-400">retrieval.py</code>
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

export default Docs;
