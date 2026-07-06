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
  embedding: 'Embedding query…',
  retrieving: 'Searching knowledge base…',
  generating: 'Generating answer…',
};

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="space-y-3 break-words">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h3 className="text-base font-semibold text-text-primary">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-semibold text-text-primary">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold text-text-primary">{children}</h4>,
          p: ({ children }) => <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-sm text-text-primary">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-sm text-text-primary">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          code: ({ children }) => <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-accent-primary">{children}</code>,
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
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center mb-4">
              <Zap size={28} className="text-accent-primary" />
            </div>
            <h3 className="text-text-primary font-semibold mb-2">Ask your documents anything</h3>
            <p className="text-text-muted text-sm max-w-sm">
              Upload documents first, then query them with natural language. The AI will find relevant passages and generate a grounded answer.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={15} className="text-accent-primary" />
                </div>
              )}

              <div className={clsx('max-w-[80%] space-y-2', msg.role === 'user' ? 'items-end flex flex-col' : '')}>
                <div
                  className={clsx(
                    'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-accent-primary text-white rounded-tr-sm'
                      : 'bg-bg-card border border-border text-text-primary rounded-tl-sm'
                  )}
                >
                  {msg.content ? (
                    msg.role === 'assistant' ? <AssistantMessage content={msg.content} /> : <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="flex items-center gap-2 text-text-muted">
                      <Loader2 size={13} className="animate-spin" />
                      <span className="text-xs">{STAGE_LABELS[stage] || 'Thinking…'}</span>
                    </div>
                  )}
                  {msg.isStreaming && msg.content && (
                    <span className="inline-block w-0.5 h-4 bg-accent-primary animate-pulse ml-1 align-text-bottom" />
                  )}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-text-muted text-xs px-1">Sources</p>
                    {msg.sources.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-3 py-2 bg-bg-hover border border-border rounded-lg text-xs"
                      >
                        <span className="text-accent-primary font-mono font-semibold flex-shrink-0">[{i + 1}]</span>
                        <div className="min-w-0">
                          <p className="text-text-secondary font-medium truncate">{s.original_name}</p>
                          <p className="text-text-muted mt-0.5 line-clamp-2">{s.text}</p>
                          <p className="text-text-muted mt-0.5">
                            Score: <span className="text-accent-primary font-mono">{(s.score * 100).toFixed(1)}%</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {msg.processingTime !== undefined && (
                  <p className="text-text-muted text-xs px-1">
                    Generated in {msg.processingTime.toFixed(2)}s
                  </p>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-bg-card border border-border flex items-center justify-center flex-shrink-0 mt-1">
                  <User size={15} className="text-text-secondary" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 bg-bg-secondary">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents…"
              rows={1}
              disabled={isLoading}
              className="w-full bg-bg-card border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-purple/60 transition-colors disabled:opacity-50"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
          </div>

          <div className="flex items-center gap-2 pb-1">
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-bg-card border border-border rounded-lg px-2 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent-purple/60"
              title="Number of source chunks to retrieve"
            >
              {[3, 5, 8, 10].map((k) => (
                <option key={k} value={k}>top {k}</option>
              ))}
            </select>

            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-accent-purple hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <Send size={16} className="text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
