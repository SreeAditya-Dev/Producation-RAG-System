import { useState } from 'react';
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
  Play
} from 'lucide-react';
import { clsx } from 'clsx';

export function Docs() {
  const [activeTab, setActiveTab] = useState<'blueprint' | 'ingestion' | 'retrieval' | 'config'>('blueprint');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const configParams = [
    { name: 'llm_model', value: 'meta/llama-3.3-70b-instruct', desc: 'LLM for streaming completion generation.', type: 'String', provider: 'NVIDIA NIM' },
    { name: 'embedding_model', value: 'nvidia/nv-embedqa-e5-v5', desc: 'Dense passage retrieval vectorizer.', type: 'String', provider: 'NVIDIA NIM' },
    { name: 'embedding_dimension', value: '1024', desc: 'Size of vectors generated for Pinecone.', type: 'Integer', provider: 'NVIDIA NIM' },
    { name: 'reranker_model', value: 'nvidia/llama-3.2-nv-rerankqa-1b-v2', desc: 'Neural cross-encoder reranker.', type: 'String', provider: 'NVIDIA NIM' },
    { name: 'max_chunk_size', value: '512 chars', desc: 'Soft limit on character count per chunk.', type: 'Integer', provider: 'Splitter' },
    { name: 'chunk_overlap', value: '50 chars', desc: 'Characters shared between adjacent chunks.', type: 'Integer', provider: 'Splitter' },
    { name: 'top_k', value: '5', desc: 'Final context segments fed into LLM prompt.', type: 'Integer', provider: 'Pipeline' },
    { name: 'candidates_multiplier', value: '4 (k=20 over-fetch)', desc: 'Pre-rerank retrieval candidate pool multiplier.', type: 'Integer', provider: 'Pipeline' },
    { name: 'min_score_threshold', value: '0.3', desc: 'Filter out context chunks below this Pinecone similarity.', type: 'Float', provider: 'Pinecone' },
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
      badge: "Stage 0: Download"
    },
    {
      title: "Structure-Aware Text Extraction",
      desc: "The system reads raw bytes and extracts layout-aware clean text. PDF parsing uses pdfplumber & pymupdf, Word files use python-docx. Scanned images run through OCR with pytesseract & Pillow.",
      icon: Terminal,
      badge: "Stage 1: Parse"
    },
    {
      title: "Recursive Text Splitting",
      desc: "Text is split recursively using separators [\\n\\n, \\n, sentence dots, spaces] to stay under max_chunk_size (512 chars) with chunk_overlap (50 chars), maintaining structural continuity.",
      icon: Layers,
      badge: "Stage 2: Chunk"
    },
    {
      title: "NVIDIA Neural Embedding",
      desc: "Text chunks are batched (size=16) and dispatched to the NVIDIA NIM Embedding API (nvidia/nv-embedqa-e5-v5). It yields dense 1024-dimensional vectors representing semantic content.",
      icon: Cpu,
      badge: "Stage 3: Embed"
    },
    {
      title: "Pinecone Vector Sync",
      desc: "Embeddings are sent alongside rich metadata (original filename, document ID, chunk index, char boundaries, boundary type, text preview) to a Pinecone serverless index with cosine metrics.",
      icon: Database,
      badge: "Stage 4: Upsert"
    },
    {
      title: "RAG Retrieval & Rerank Query",
      desc: "A user query is vectorized via e5-v5. Pinecone performs HNSW search to fetch 20 candidate vectors (top_k * 4). NVIDIA Reranker (llama-3.2-1b) re-scores them to fetch top 5.",
      icon: Activity,
      badge: "Stage 5: Query"
    },
    {
      title: "Augmented Generation & Evaluation",
      desc: "Re-ordered context chunks are formatted into a prompt. meta/llama-3.3-70b streams the response. A proxy faithfulness rating is calculated using the sigmoid of rerank scores.",
      icon: Workflow,
      badge: "Stage 6: Generate"
    }
  ];

  return (
    <div className="px-6 py-6 mx-auto w-full h-full max-w-[1600px] font-sans text-zinc-300">
      <div className="space-y-6">
        
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-900">
          <div>
            <h1 className="text-sm font-mono tracking-widest uppercase font-bold text-white flex items-center gap-2">
              <BookOpen size={13} className="text-[#F4831F]" />
              System Documentation
            </h1>
            <p className="text-zinc-550 text-xs mt-1 font-mono">
              Deep dive into the production RAG architecture, service layers, and live pipelines.
            </p>
          </div>
          
          {/* Quick stats badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded border border-zinc-800 bg-[#000000] text-[10px] font-mono text-orange-500 font-bold">
              <Cpu size={10} /> LLM: Llama-3.3-70B NIM
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded border border-zinc-800 bg-[#000000] text-[10px] font-mono text-blue-400 font-bold">
              <Database size={10} /> Vector: Pinecone Serverless
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded border border-zinc-800 bg-[#000000] text-[10px] font-mono text-emerald-400 font-bold">
              <Activity size={10} /> Vector Size: 1024d
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-900 pb-px gap-1">
          {[
            { id: 'blueprint', label: 'Architecture Blueprint', icon: Workflow },
            { id: 'ingestion', label: 'Ingestion Layer', icon: Layers },
            { id: 'retrieval', label: 'Retrieval & Rerank', icon: Cpu },
            { id: 'config', label: 'Active Parameters', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold transition-all border-b-2 -mb-px cursor-pointer",
                  active 
                    ? "border-[#F4831F] text-white bg-zinc-900/30" 
                    : "border-transparent text-zinc-500 hover:text-zinc-350 hover:bg-zinc-900/10"
                )}
              >
                <Icon size={12} className={clsx(active ? "text-[#F4831F]" : "text-zinc-650")} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Panel Contents */}
        <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              
              {/* Tab 1: Architecture Blueprint (Interactive Layout) */}
              {activeTab === 'blueprint' && (
                <div className="space-y-6">
                  
                  {/* Pipeline Visual Flow Simulator */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
                    
                    {/* Flow Map Visualizer */}
                    <div className="border border-zinc-800 bg-[#000000] p-6 rounded-lg space-y-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/2 rounded-full blur-3xl pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/2 rounded-full blur-3xl pointer-events-none" />
                      
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#F4831F] font-semibold">Interactive Dataflow Map</span>
                        <span className="font-mono text-[9px] text-zinc-550">CLICK ANY STAGE TO PREVIEW PATHWAY DETAILS</span>
                      </div>

                      {/* Flex flow row nodes */}
                      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center justify-between relative py-6 px-2">
                        {/* Connecting Line for Desktops */}
                        <div className="absolute top-1/2 left-4 right-4 h-px bg-zinc-800 -translate-y-1/2 z-0 hidden md:block" />
                        
                        {pipelineSteps.map((step, idx) => {
                          const StepIcon = step.icon;
                          const isActive = activeStep === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => setActiveStep(idx)}
                              className={clsx(
                                "relative z-10 flex flex-row md:flex-col items-center gap-3 md:gap-2 px-3 py-2 md:py-3 rounded-lg border text-left md:text-center transition-all w-full md:w-28 cursor-pointer focus:outline-none",
                                isActive 
                                  ? "border-orange-500/80 bg-orange-950/20 shadow-[0_0_15px_rgba(244,131,31,0.15)]" 
                                  : "border-zinc-800 bg-[#07070a]/90 hover:border-zinc-700"
                              )}
                            >
                              <div className={clsx(
                                "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
                                isActive 
                                  ? "bg-orange-500 text-[#0c0c0e] border-orange-400" 
                                  : "bg-zinc-950 text-zinc-450 border-zinc-800"
                              )}>
                                <StepIcon size={14} />
                              </div>
                              <div>
                                <p className="font-mono text-[9px] text-zinc-550 block">0{idx + 1}</p>
                                <p className={clsx(
                                  "text-[10px] font-bold tracking-tight md:truncate max-w-[120px]",
                                  isActive ? "text-white" : "text-zinc-400"
                                )}>
                                  {step.title.split(' ')[0]} {step.title.split(' ')[1] || ''}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Render Current Step Details */}
                      <div className="border border-zinc-800/80 bg-[#07070a] p-4 rounded-lg flex items-start gap-4">
                        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-[#F4831F]">
                          {(() => {
                            const CurrIcon = pipelineSteps[activeStep].icon;
                            return <CurrIcon size={20} />;
                          })()}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] bg-orange-950/60 border border-orange-900/60 text-orange-400 px-2 py-0.5 rounded">
                              {pipelineSteps[activeStep].badge}
                            </span>
                            <h3 className="text-xs font-bold text-white font-mono">{pipelineSteps[activeStep].title}</h3>
                          </div>
                          <p className="text-[11px] text-zinc-450 leading-relaxed font-mono mt-1.5">
                            {pipelineSteps[activeStep].desc}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Architectural Pillars Card */}
                    <div className="border border-zinc-800 bg-[#000000] p-5 rounded-lg space-y-4">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold font-mono">Architectural Pillars</p>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            FastAPI & SQLite Backing
                          </h4>
                          <p className="text-[10px] text-zinc-450 leading-relaxed font-mono pl-3">
                            The backend runs uvicorn serving a fast async API. Document status metadata and query performance parameters are persisted in SQLAlchemy models to guarantee complete operational metrics histories.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Over-fetch + Rerank
                          </h4>
                          <p className="text-[10px] text-zinc-450 leading-relaxed font-mono pl-3">
                            Mitigates single-stage HNSW query errors. The retriever over-fetches candidates (K=20) to ensure high recall, then passes candidates to a Cross-Encoder reranker to score precision prior to LLM mapping.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            WebSocket Telemetry
                          </h4>
                          <p className="text-[10px] text-zinc-450 leading-relaxed font-mono pl-3">
                            Maintains live pipelines. High-frequency updates during document chunks and queries are broadcasted to the Vite frontend dynamically, mapping ingestion logs without reloading.
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Flow chart layout block */}
                  <div className="border border-zinc-800 bg-[#000000] p-6 rounded-lg space-y-4 font-mono">
                    <p className="text-[9px] uppercase tracking-widest text-[#F4831F] font-semibold">Data Pipeline Schematic</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-lg space-y-2 relative">
                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-zinc-800 hidden md:block"><ArrowRight size={14} /></div>
                        <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider">1. Ingestion Layer</h4>
                        <ul className="space-y-1 text-[10px] text-zinc-400">
                          <li>&bull; Read file payload (local/S3)</li>
                          <li>&bull; Extract text (OCR fallback)</li>
                          <li>&bull; RecursiveTextSplitter (512 max)</li>
                          <li>&bull; Embed chunks (e5-v5 NIM API)</li>
                          <li>&bull; Upsert vector records (Pinecone)</li>
                        </ul>
                      </div>

                      <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-lg space-y-2 relative">
                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-zinc-800 hidden md:block"><ArrowRight size={14} /></div>
                        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">2. Context Retrieval</h4>
                        <ul className="space-y-1 text-[10px] text-zinc-400">
                          <li>&bull; User prompt embedded (e5-v5)</li>
                          <li>&bull; HNSW cosine search (K=top_k * 4)</li>
                          <li>&bull; Score threshold filter (&gt;= 0.3)</li>
                          <li>&bull; Cross-encoder Reranker (llama-3.2-1b)</li>
                          <li>&bull; Reranked candidates top_k output</li>
                        </ul>
                      </div>

                      <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-lg space-y-2">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">3. Completion Studio</h4>
                        <ul className="space-y-1 text-[10px] text-zinc-400">
                          <li>&bull; Inject chunks into system prompt</li>
                          <li>&bull; Call Llama-3.3-70B completion API</li>
                          <li>&bull; Real-time token streaming</li>
                          <li>&bull; Calculate sigmoid faithfulness</li>
                          <li>&bull; Persist historical query metrics</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Ingestion Layer Details */}
              {activeTab === 'ingestion' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_500px] gap-6 items-start">
                  
                  {/* Left Column: Descriptive prose */}
                  <div className="space-y-6">
                    <div className="border border-zinc-800 bg-[#000000] p-6 rounded-lg space-y-4 font-mono text-[11px] leading-relaxed text-zinc-400">
                      <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">Ingestion Lifecycle Breakdown</h2>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-white font-bold mb-1">01. Parsing & Content Extraction</h3>
                          <p>
                            Extracting text from raw file formats is the crucial first layer. The system routes files to specific modules inside <code className="text-orange-400 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-900">app/utils/file_parsers.py</code>:
                          </p>
                          <ul className="list-disc pl-4 mt-1 space-y-0.5 text-zinc-450">
                            <li><strong className="text-zinc-300">PDF Engines:</strong> Defaults to <code className="text-zinc-400">pdfplumber</code> for layouts, falling back to <code className="text-zinc-400">pymupdf</code> for scan operations.</li>
                            <li><strong className="text-zinc-300">OCR fallbacks:</strong> Scanned documents trigger <code className="text-zinc-400">pytesseract</code> OCR pipelines, validating structure via Pillow image rendering.</li>
                            <li><strong className="text-zinc-300">DOCX Files:</strong> Parses structural paragraph tables using <code className="text-zinc-400">python-docx</code>.</li>
                          </ul>
                        </div>

                        <div>
                          <h3 className="text-white font-bold mb-1">02. Recursive Semantic Chunking</h3>
                          <p>
                            Rather than splitting text at arbitrary lengths, the engine runs a custom recursive text splitter. It targets separators in hierarchical order (Double newlines &rarr; single newlines &rarr; sentence boundaries &rarr; word spaces).
                          </p>
                          <p className="mt-1">
                            This guarantees that blocks remain semantic, cohesive segments. Setting <code className="text-orange-400">chunk_size=512</code> and <code className="text-orange-400">chunk_overlap=50</code> ensures overlaps do not break sentence contexts.
                          </p>
                        </div>

                        <div>
                          <h3 className="text-white font-bold mb-1">03. Embedding Generator (NVIDIA NIM)</h3>
                          <p>
                            Chunks are batched (size=16) to leverage concurrent requests. We call the NVIDIA NIM embedding service endpoint using the <code className="text-zinc-300">nvidia/nv-embedqa-e5-v5</code> model, which yields 1024-dimensional floating point vectors.
                          </p>
                        </div>

                        <div>
                          <h3 className="text-white font-bold mb-1">04. Serverless Pinecone Vector Upserts</h3>
                          <p>
                            Vectors are uploaded directly with a clean metadata envelope containing:
                          </p>
                          <ul className="list-disc pl-4 mt-1 space-y-0.5 text-zinc-450">
                            <li><code className="text-zinc-400">doc_id</code>: Relational index corresponding to database records.</li>
                            <li><code className="text-zinc-400">original_name</code> & <code className="text-zinc-400">file_type</code>: Original source details.</li>
                            <li><code className="text-zinc-400">chunk_index</code>, <code className="text-zinc-400">char_start</code>, <code className="text-zinc-400">char_end</code>: Layout bounds tracking.</li>
                            <li><code className="text-zinc-400">text</code>: Raw characters preview up to 1000 characters.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Code block demonstrating custom splitter */}
                  <div className="space-y-4">
                    <div className="border border-zinc-800 bg-[#000000] rounded-lg overflow-hidden flex flex-col">
                      <div className="flex justify-between items-center px-4 py-3 bg-zinc-950/70 border-b border-zinc-850">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 font-semibold flex items-center gap-1.5">
                          <Code size={11} className="text-orange-500" />
                          app/utils/chunking.py (Recursive Splitter)
                        </span>
                        <button
                          onClick={() => handleCopy(codeSnippets.splitter, 'splitter')}
                          className="px-2 py-1 text-[9px] border border-zinc-800 bg-zinc-900 text-zinc-450 hover:bg-zinc-800 hover:text-white rounded transition font-mono cursor-pointer"
                        >
                          {copiedCode === 'splitter' ? 'Copied!' : 'Copy Snippet'}
                        </button>
                      </div>
                      
                      <div className="p-4 bg-zinc-950 font-mono text-[11px] overflow-x-auto text-zinc-400 select-all whitespace-pre">
                        {codeSnippets.splitter}
                      </div>
                    </div>

                    <div className="border border-zinc-850 bg-zinc-950/30 p-4 rounded-lg flex items-start gap-2.5 font-mono text-[10px] text-zinc-450">
                      <Info size={14} className="text-[#F4831F] shrink-0 mt-0.5" />
                      <span>
                        <strong>Note on Overlap:</strong> The recursive text splitter will backtrack by exactly <code className="text-orange-400">chunk_overlap</code> characters whenever a boundary is hit, maintaining structural continuity across chunks.
                      </span>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 3: Retrieval & Reranking details */}
              {activeTab === 'retrieval' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_500px] gap-6 items-start">
                  
                  {/* Left Column: Retrieval Explanation */}
                  <div className="space-y-6">
                    <div className="border border-zinc-800 bg-[#000000] p-6 rounded-lg space-y-4 font-mono text-[11px] leading-relaxed text-zinc-400">
                      <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">Retrieval & Completion Studio Lifecycle</h2>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h3 className="text-white font-bold mb-1">01. Query Embedding & Over-fetch</h3>
                          <p>
                            Incoming user queries are embedded using the same neural models as ingestion. Using the Pinecone database client, we perform an initial HNSW-based vector search. 
                          </p>
                          <p className="mt-1">
                            To combat semantic shifts in vector spaces, we over-fetch candidates using a multiplier of 4. E.g. <code className="text-blue-400">k = top_k * 4</code>. If 5 chunks are requested, we retrieve 20.
                          </p>
                        </div>

                        <div>
                          <h3 className="text-white font-bold mb-1">02. Score Threshold Filtering</h3>
                          <p>
                            Retrieved chunks below a cosine similarity score of <code className="text-blue-400">0.3</code> are filtered out. If zero chunks exceed this value, the pipeline defaults to returning the top 3 matches to avoid leaving the system with empty context.
                          </p>
                        </div>

                        <div>
                          <h3 className="text-white font-bold mb-1">03. Neural Reranking via Cross-Encoder</h3>
                          <p>
                            Retrieved chunks are passed along with the query to the NVIDIA NIM Reranking API using <code className="text-blue-400">nvidia/llama-3.2-nv-rerankqa-1b-v2</code>. 
                          </p>
                          <p className="mt-1">
                            Unlike dual-encoders (which map texts in isolation), a cross-encoder scores the query and document together, assessing fine-grained semantic relevance. We return the top <code className="text-blue-400">top_k</code> highest-scoring chunks.
                          </p>
                        </div>

                        <div>
                          <h3 className="text-white font-bold mb-1">04. Sigmoid-based Faithfulness Evaluation</h3>
                          <p>
                            Before the LLM processes context, the pipeline calculates a proxy score for Faithfulness: <code className="text-zinc-200">sigmoid(mean_rerank_logit)</code>. 
                          </p>
                          <p className="mt-1">
                            A high rating (closer to 1.0) guarantees that the retrieved chunks are strongly aligned with the user query, decreasing the likelihood of model hallucinations.
                          </p>
                        </div>

                        <div>
                          <h3 className="text-white font-bold mb-1">05. Reranked Context Injected Generation</h3>
                          <p>
                            The sorted chunks are formatted into a system instructions block. The completion request is forwarded to <code className="text-blue-400">meta/llama-3.3-70b-instruct</code>, streaming answers back via WebSockets.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Code block demonstrating reranking pipeline and faithfulness math */}
                  <div className="space-y-4">
                    <div className="border border-zinc-800 bg-[#000000] rounded-lg overflow-hidden flex flex-col">
                      <div className="flex justify-between items-center px-4 py-3 bg-zinc-950/70 border-b border-zinc-850">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 font-semibold flex items-center gap-1.5">
                          <Code size={11} className="text-blue-500" />
                          app/pipeline/retrieval.py (Rerank Step)
                        </span>
                        <button
                          onClick={() => handleCopy(codeSnippets.rerank, 'rerank')}
                          className="px-2 py-1 text-[9px] border border-zinc-800 bg-zinc-900 text-zinc-450 hover:bg-zinc-800 hover:text-white rounded transition font-mono cursor-pointer"
                        >
                          {copiedCode === 'rerank' ? 'Copied!' : 'Copy Snippet'}
                        </button>
                      </div>
                      <div className="p-4 bg-zinc-950 font-mono text-[11px] overflow-x-auto text-zinc-455 whitespace-pre">
                        {codeSnippets.rerank}
                      </div>
                    </div>

                    <div className="border border-zinc-800 bg-[#000000] rounded-lg overflow-hidden flex flex-col">
                      <div className="flex justify-between items-center px-4 py-3 bg-zinc-950/70 border-b border-zinc-850">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 font-semibold flex items-center gap-1.5">
                          <Code size={11} className="text-emerald-500" />
                          Faithfulness Evaluation Math
                        </span>
                        <button
                          onClick={() => handleCopy(codeSnippets.faithfulness, 'faithfulness')}
                          className="px-2 py-1 text-[9px] border border-zinc-800 bg-zinc-900 text-zinc-450 hover:bg-zinc-800 hover:text-white rounded transition font-mono cursor-pointer"
                        >
                          {copiedCode === 'faithfulness' ? 'Copied!' : 'Copy Snippet'}
                        </button>
                      </div>
                      <div className="p-4 bg-zinc-950 font-mono text-[11px] overflow-x-auto text-zinc-455 whitespace-pre">
                        {codeSnippets.faithfulness}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 4: Active Parameters (Config Reference) */}
              {activeTab === 'config' && (
                <div className="space-y-6">
                  
                  {/* Parameter table */}
                  <div className="border border-zinc-800 bg-[#000000] rounded-lg overflow-hidden">
                    <div className="px-6 py-4 bg-zinc-950/40 border-b border-zinc-900">
                      <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Active Configuration Variables</h3>
                      <p className="text-[10px] text-zinc-550 font-mono mt-1">
                        Active pipeline configuration declared inside <code className="text-orange-400 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-900">backend/app/config.py</code>.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                          <tr className="border-b border-zinc-900 bg-zinc-950/60 text-zinc-500 font-bold">
                            <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Parameter Name</th>
                            <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Provider / Component</th>
                            <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Type</th>
                            <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Default Value</th>
                            <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Function / Impact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 text-zinc-400 bg-black">
                          {configParams.map((param, index) => (
                            <tr key={index} className="hover:bg-zinc-900/10">
                              <td className="px-6 py-3.5 font-bold text-zinc-200">{param.name}</td>
                              <td className="px-6 py-3.5 text-zinc-450">{param.provider}</td>
                              <td className="px-6 py-3.5 text-zinc-500">{param.type}</td>
                              <td className="px-6 py-3.5 font-semibold text-orange-400">{param.value}</td>
                              <td className="px-6 py-3.5 text-zinc-450 leading-normal">{param.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Architecture stack badges list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-zinc-800 bg-[#000000] p-5 rounded-lg space-y-3">
                      <h4 className="text-xs font-bold text-white font-mono uppercase tracking-widest flex items-center gap-2">
                        <Server size={12} className="text-orange-500" />
                        Relational Database Models
                      </h4>
                      <div className="space-y-3 font-mono text-[10px] text-zinc-450">
                        <div className="border-l border-zinc-800 pl-3">
                          <strong className="text-zinc-300">Document Model:</strong>
                          <p className="mt-0.5">Tracks primary payload keys, statuses (<code className="text-orange-400">pending</code>, <code className="text-blue-400">parsing</code>, <code className="text-emerald-400">ready</code>, <code className="text-red-400">error</code>), S3 key metadata, and total chunk counts.</p>
                        </div>
                        <div className="border-l border-zinc-800 pl-3">
                          <strong className="text-zinc-300">IngestionMetrics Model:</strong>
                          <p className="mt-0.5">Audits timestamps and latencies per ingestion stage (download_ms, parse_ms, chunk_ms, embed_ms, store_ms, total_ms) to discover document parsing bottleneck layers.</p>
                        </div>
                        <div className="border-l border-zinc-800 pl-3">
                          <strong className="text-zinc-300">QueryHistory / QueryMetrics Model:</strong>
                          <p className="mt-0.5">Persists questions, raw answers, source references (as JSON lists), prompt/completion tokens, and faithfulness ratings for queries.</p>
                        </div>
                      </div>
                    </div>

                    <div className="border border-zinc-800 bg-[#000000] p-5 rounded-lg space-y-3">
                      <h4 className="text-xs font-bold text-white font-mono uppercase tracking-widest flex items-center gap-2">
                        <Zap size={12} className="text-orange-500" />
                        Infrastructure Layer
                      </h4>
                      <div className="space-y-3 font-mono text-[10px] text-zinc-450">
                        <div className="border-l border-zinc-800 pl-3">
                          <strong className="text-zinc-300">NVIDIA NIM:</strong>
                          <p className="mt-0.5">Hosts neural inferencing modules. Connects to integrate.api.nvidia.com/v1 for llama-3.3-70b-instruct completions, nv-embedqa-e5-v5 embeddings, and llama-3.2-nv-rerankqa-1b-v2 rerankers.</p>
                        </div>
                        <div className="border-l border-zinc-800 pl-3">
                          <strong className="text-zinc-300">Pinecone Serverless:</strong>
                          <p className="mt-0.5">Scales vector search on aws/us-east-1. Index dimensions match e5-v5 (1024d) utilizing Cosine metric algorithms to determine vector similarities.</p>
                        </div>
                        <div className="border-l border-zinc-800 pl-3">
                          <strong className="text-zinc-300">Local uploads / S3:</strong>
                          <p className="mt-0.5">File payload repository. Downloaded asynchronously to temporary file directories, parsed, then immediately purged to ensure security and disk cleanup.</p>
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
