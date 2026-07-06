import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Zap, CornerDownLeft, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import type { QueryResponse } from '../../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: QueryResponse['sources'];
  processingTime?: number;
  isStreaming?: boolean;
}

interface Props {
  onQuery: (q: string, topK: number) => Promise<QueryResponse | undefined>;
  streamingAnswer: string;
  isLoading: boolean;
  stage: string;
}

const STAGE_LABELS: Record<string, string> = {
  embedding: 'Calculating prompt embeddings...',
  retrieving: 'Scanning vector nodes in Pinecone...',
  reranking: 'Executing NIM reranker...',
  generating: 'Synthesizing response tokens...',
};

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="space-y-3 break-words font-sans text-xs leading-relaxed text-zinc-300">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h3 className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-wide mt-4 mb-2">{children}</h3>,
          h2: ({ children }) => <h3 className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-wide mt-3 mb-1">{children}</h3>,
          h3: ({ children }) => <h4 className="text-[11px] font-mono font-bold text-zinc-200 mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="text-xs leading-relaxed text-zinc-300 mb-2.5">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-400 mb-3">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4 text-xs text-zinc-400 mb-3">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-zinc-950 border border-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="rounded-lg border border-zinc-900 bg-zinc-950 p-3 overflow-x-auto text-[10px] font-mono text-zinc-300 leading-normal my-3">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatInterface({ onQuery, streamingAnswer, isLoading, stage }: Props) {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [topK, setTopK] = useState(5);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingAnswer]);

  // Trigger question from command palette navigation
  useEffect(() => {
    const routeState = location.state as { initialQuestion?: string } | null;
    if (routeState?.initialQuestion && messages.length === 0 && !isLoading) {
      const q = routeState.initialQuestion;
      
      // Clear route state so we don't re-run on reload
      window.history.replaceState({}, document.title);
      
      const triggerQuery = async () => {
        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: q };
        const assistantId = (Date.now() + 1).toString();
        streamMsgIdRef.current = assistantId;

        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: assistantId, role: 'assistant', content: '', isStreaming: true },
        ]);

        try {
          const result = await onQuery(q, topK);
          if (result) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: result.answer,
                      sources: result.sources,
                      processingTime: result.processing_time,
                      isStreaming: false,
                    }
                  : m
              )
            );
          }
        } catch (err: any) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${err.message}`, isStreaming: false }
                : m
            )
          );
        }
      };

      triggerQuery();
    }
  }, [location.state, onQuery, topK, isLoading, messages.length]);

  useEffect(() => {
    if (streamingAnswer && streamMsgIdRef.current) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamMsgIdRef.current ? { ...m, content: streamingAnswer, isStreaming: true } : m
        )
      );
    }
  }, [streamingAnswer]);

  const handleSubmit = async () => {
    const q = input.trim();
    if (!q || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: q };
    const assistantId = (Date.now() + 1).toString();
    streamMsgIdRef.current = assistantId;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ]);
    setInput('');

    try {
      const result = await onQuery(q, topK);
      if (result) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: result.answer,
                  sources: result.sources,
                  processingTime: result.processing_time,
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Error: Connection lost. Failed to synthesize answer.', isStreaming: false }
            : m
        )
      );
    }
    streamMsgIdRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#000000]">
      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full max-w-[500px] mx-auto text-center px-6 py-12 font-sans select-none">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-[#F4831F]">
              <Zap size={14} />
            </div>
            <h3 className="text-zinc-200 font-mono text-xs uppercase tracking-widest font-semibold">Grounded RAG Workspace</h3>
            <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed max-w-xs font-mono">
              Vector-backed query synthesis engine. Enter queries below to observe real-time retrieval parameters.
            </p>
            
            {/* Active specs grid */}
            <div className="mt-8 w-full border border-zinc-800 rounded bg-[#09090b]/40 p-4 text-left font-mono text-[10px] text-zinc-400 space-y-2">
              <div className="text-[9px] uppercase tracking-widest text-[#F4831F] font-semibold border-b border-zinc-900/80 pb-1.5 mb-2 flex items-center gap-1.5">
                <Sparkles size={10} />
                Active Core Ingestion Specs
              </div>
              <div className="flex justify-between"><span className="text-zinc-600">Embedding model:</span><span className="text-zinc-300">NV-EmbedQA-E5-v5</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">Vector store:</span><span className="text-zinc-300">Pinecone (Cosine Index)</span></div>
              <div className="flex justify-between"><span className="text-zinc-655">Reranker algorithm:</span><span className="text-zinc-300">NIM Cross-Encoder Llama-3</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">Synthesis LLM:</span><span className="text-zinc-300">Llama-3.3-70B-Spec</span></div>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-6 p-6 hover:bg-zinc-950/20 transition-colors border-b border-zinc-900/50"
            >
              {/* Monospace Indicator Tag */}
              <div className="w-[84px] shrink-0 font-mono text-[9px] uppercase tracking-widest font-bold text-zinc-600 pt-0.5 select-none">
                {msg.role === 'assistant' ? 'assistant' : 'user'}
              </div>

              {/* Content Column */}
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-zinc-600">
                    ID: {msg.id}
                  </span>
                  {msg.processingTime !== undefined && (
                    <span className="text-[9px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded">
                      latency: <span className="text-[#F4831F] font-bold">{msg.processingTime.toFixed(2)}s</span>
                    </span>
                  )}
                </div>

                <div className="text-zinc-200">
                  {msg.content ? (
                    msg.role === 'assistant' ? (
                      <AssistantMessage content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-200 font-sans font-medium">
                        {msg.content}
                      </p>
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-zinc-550">
                      <Loader2 size={12} className="animate-spin text-[#F4831F]" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-450">
                        {STAGE_LABELS[stage] || 'Searching indices...'}
                      </span>
                    </div>
                  )}
                  {msg.isStreaming && msg.content && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#F4831F] animate-pulse ml-1 align-middle" />
                  )}
                </div>

                {/* Sources list */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-4 border-t border-zinc-950 space-y-3">
                    <p className="text-zinc-550 text-[9px] uppercase tracking-widest font-mono font-semibold">
                      Grounded Context Citations
                    </p>
                    <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                      {msg.sources.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 p-3 bg-zinc-950/60 border border-zinc-900 rounded text-xs hover:border-zinc-800 transition-colors"
                        >
                          <span className="text-zinc-600 font-mono text-[9px] font-bold flex-shrink-0">
                            [{String(i + 1).padStart(2, '0')}]
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-zinc-300 font-mono text-[10px] font-semibold truncate" title={s.original_name}>
                              {s.original_name}
                            </p>
                            <p className="text-zinc-550 text-[10px] line-clamp-2 mt-1 leading-relaxed font-sans">
                              {s.text}
                            </p>
                            <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-zinc-900/50">
                              <span className="text-zinc-600 text-[8px] uppercase tracking-wider font-mono">Similarity:</span>
                              <span className="text-[#F4831F] font-mono text-[9px] font-semibold">{(s.score * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input panel */}
      <div className="border-t border-zinc-900 bg-black px-6 py-4">
        <div className="max-w-[700px] mx-auto w-full space-y-2">
          <div className="relative flex items-stretch border border-zinc-800 rounded bg-zinc-950 focus-within:border-[#F4831F]/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question grounded in vector data..."
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent px-4 py-3 text-xs text-white placeholder-zinc-600 resize-none focus:outline-none disabled:opacity-50 font-sans leading-relaxed"
              style={{ maxHeight: '100px', overflowY: 'auto' }}
            />
            
            {/* Input Tools inside textarea bar */}
            <div className="flex items-center gap-1.5 px-3 shrink-0 select-none">
              <span className="text-[9px] text-zinc-600 font-mono flex items-center gap-1 border border-zinc-900 px-1.5 py-0.5 rounded">
                Top-K
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="bg-transparent text-zinc-450 font-bold border-none outline-none focus:outline-none cursor-pointer pr-1"
                  title="Sources to retrieve"
                >
                  {[3, 5, 8, 10].map((k) => (
                    <option key={k} value={k} className="bg-zinc-950 text-zinc-400">
                      {k}
                    </option>
                  ))}
                </select>
              </span>

              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="w-7 h-7 rounded bg-[#F4831F] hover:bg-[#d96c14] text-white disabled:bg-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed flex items-center justify-center transition-colors border border-[#d96c14]/40 cursor-pointer"
                title="Send query"
              >
                {isLoading ? (
                  <Loader2 size={11} className="animate-spin text-white" />
                ) : (
                  <Send size={10} />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[8px] font-mono text-zinc-600 px-1">
            <span>ENTER TO TRANSMIT &middot; SHIFT+ENTER FOR NEWLINE</span>
            <span className="flex items-center gap-1">
              <CornerDownLeft size={8} /> READY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
