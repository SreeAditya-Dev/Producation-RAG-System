import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Bot, User, Zap } from 'lucide-react';
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
  embedding: 'Embedding query vector...',
  retrieving: 'Querying vector database...',
  generating: 'Synthesizing response...',
};

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="space-y-3 break-words">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h3 className="text-sm font-semibold text-zinc-100">{children}</h3>,
          h2: ({ children }) => <h3 className="text-sm font-semibold text-zinc-100">{children}</h3>,
          h3: ({ children }) => <h4 className="text-xs font-semibold text-zinc-200">{children}</h4>,
          p: ({ children }) => <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-300">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4 text-xs text-zinc-300">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-zinc-900 border border-zinc-800/80 px-1 py-0.5 text-xs text-zinc-200 font-mono">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatInterface({ onQuery, streamingAnswer, isLoading, stage }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [topK, setTopK] = useState(5);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingAnswer]);

  // Update streaming message
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
            ? { ...m, content: 'Sorry, something went wrong. Please try again.', isStreaming: false }
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
    <div className="flex flex-col h-full bg-[#09090b]">
      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-10 h-10 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-400">
              <Zap size={16} />
            </div>
            <h3 className="text-zinc-200 font-semibold text-sm">Query Grounded Workspace</h3>
            <p className="text-zinc-500 text-xs max-w-sm mt-1 leading-normal font-mono">
              Input a natural language query. The engine will retrieve candidate slices from vector inventory and synthesize context-backed responses.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 p-5 hover:bg-zinc-900/5 transition-colors"
            >
              {/* Avatar Column */}
              <div className="w-7 h-7 rounded border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-400 shrink-0 select-none mt-0.5">
                {msg.role === 'assistant' ? <Bot size={13} /> : <User size={13} />}
              </div>

              {/* Content Column */}
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">
                    {msg.role === 'assistant' ? 'Assistant' : 'User'}
                  </span>
                  {msg.processingTime !== undefined && (
                    <span className="text-[9px] font-mono text-zinc-600">
                      &middot; {msg.processingTime.toFixed(2)}s latency
                    </span>
                  )}
                </div>

                <div className="text-zinc-300">
                  {msg.content ? (
                    msg.role === 'assistant' ? (
                      <AssistantMessage content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300 font-medium">
                        {msg.content}
                      </p>
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Loader2 size={11} className="animate-spin text-zinc-400" />
                      <span className="text-[11px] font-mono">
                        {STAGE_LABELS[stage] || 'Searching knowledge base...'}
                      </span>
                    </div>
                  )}
                  {msg.isStreaming && msg.content && (
                    <span className="inline-block w-1 h-3 bg-zinc-300 animate-pulse ml-1 align-middle" />
                  )}
                </div>

                {/* Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-zinc-500 text-[9px] uppercase tracking-wider font-mono">
                      Retrieved Contexts
                    </p>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {msg.sources.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 p-3 bg-zinc-950 border border-zinc-850 rounded-lg text-xs"
                        >
                          <span className="text-zinc-500 font-mono font-bold flex-shrink-0">
                            [{String(i + 1).padStart(2, '0')}]
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-zinc-200 font-semibold truncate" title={s.original_name}>
                              {s.original_name}
                            </p>
                            <p className="text-zinc-500 text-[10px] line-clamp-2 mt-1 leading-relaxed">
                              {s.text}
                            </p>
                            <p className="text-zinc-600 text-[9px] font-mono mt-1">
                              Cosine Similarity:{' '}
                              <span className="text-zinc-400 font-semibold">{(s.score * 100).toFixed(0)}%</span>
                            </p>
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
      <div className="border-t border-zinc-800/80 px-4 py-3 bg-[#0c0c0e]">
        <div className="flex items-end gap-2.5 max-w-[800px] mx-auto w-full">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents…"
              rows={1}
              disabled={isLoading}
              className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-500 resize-none focus:outline-none transition-all disabled:opacity-50 font-mono"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
          </div>

          <div className="flex items-center gap-2 pb-1 shrink-0">
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-lg px-2.5 py-2.5 text-xs text-zinc-400 focus:outline-none transition-colors font-mono"
              title="Number of source chunks to retrieve"
            >
              {[3, 5, 8, 10].map((k) => (
                <option key={k} value={k}>
                  top {k}
                </option>
              ))}
            </select>

            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-lg bg-white hover:bg-zinc-200 text-black disabled:bg-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed flex items-center justify-center transition-colors border border-zinc-850"
            >
              {isLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
