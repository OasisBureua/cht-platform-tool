import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUp,
  ExternalLink,
  Loader2,
  MessagesSquare,
  Square,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isCompanionEnabled } from '../config/app-urls';
import {
  isTerminalStreamError,
  streamCompanionChat,
  type ChatHistoryTurn,
  type CitationEvent,
  type DoneEvent,
  type ErrorEvent,
} from '../api/companionChat';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: CitationEvent[];
  streaming?: boolean;
  error?: string | null;
  warning?: string | null;
  finishReason?: string | null;
};

const SUGGESTIONS = [
  'What is community health media?',
  'How do I join a live webinar?',
  'Where can I find post-event surveys?',
] as const;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Map inline [c1] markers to linked chips when citations are known. */
function renderAssistantText(text: string, citations: CitationEvent[]) {
  const byId = new Map(citations.map((c) => [c.citation_id, c]));
  const parts = text.split(/(\[[cC]\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[([cC]\d+)\]$/);
    if (!m) {
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    }
    const id = m[1].toLowerCase();
    const cite = byId.get(id) || byId.get(m[1]);
    if (!cite?.url) {
      return (
        <span key={i} className="font-medium text-steel-700 dark:text-steel-300">
          {part}
        </span>
      );
    }
    return (
      <a
        key={i}
        href={cite.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-0.5 inline-flex items-center rounded-[4px] bg-steel-100 px-1 py-0.5 text-[11px] font-semibold text-steel-800 underline-offset-2 hover:underline dark:bg-steel-600/40 dark:text-steel-100"
        title={cite.title}
      >
        {part}
      </a>
    );
  });
}

export default function CompanionChat() {
  const { user, getAuthHeaders, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  if (!isCompanionEnabled()) {
    return <Navigate to="/app/home" replace />;
  }

  if (!isAuthenticated) {
    return (
      <div className="-mt-[15px] space-y-4">
        <div className="rounded-card border border-border/90 bg-card p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_30px_-16px_rgba(0,0,0,0.45)]">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Companion</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to chat with Companion about community health media.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-[6px] bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false, finishReason: 'cancelled' } : m)),
    );
  };

  const send = async (raw: string) => {
    const query = raw.trim();
    if (!query || busy) return;

    setBanner(null);
    setDraft('');
    const userMsg: ChatMessage = {
      id: newId('u'),
      role: 'user',
      content: query,
      citations: [],
    };
    const assistantId = newId('a');
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      citations: [],
      streaming: true,
      error: null,
      warning: null,
    };

    const history: ChatHistoryTurn[] = messages
      .filter((m) => m.content.trim())
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBusy(true);

    const abort = new AbortController();
    abortRef.current = abort;

    let terminal = false;

    try {
      await streamCompanionChat({
        body: { query, history, conversation_id: null },
        signal: abort.signal,
        getAuthHeaders,
        handlers: {
          onCitation: (c) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      citations: m.citations.some((x) => x.citation_id === c.citation_id)
                        ? m.citations
                        : [...m.citations, c],
                    }
                  : m,
              ),
            );
          },
          onToken: (t) => {
            if (terminal) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + t.text } : m,
              ),
            );
          },
          onError: (e: ErrorEvent) => {
            if (e.code === 'retrieval_degraded') {
              setBanner(e.message || 'Answering without knowledge-base context.');
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, warning: e.message || 'Answering without knowledge-base context.' }
                    : m,
                ),
              );
              return;
            }
            if (isTerminalStreamError(e.code)) {
              terminal = true;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, error: e.message || 'Something went wrong.', streaming: false }
                    : m,
                ),
              );
            } else {
              setBanner(e.message);
            }
          },
          onDone: (d: DoneEvent) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      streaming: false,
                      finishReason: d.finish_reason,
                    }
                  : m,
              ),
            );
          },
        },
      });
    } catch (err) {
      if (abort.signal.aborted) return;
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to reach Companion right now.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, streaming: false, error: message }
            : m,
        ),
      );
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className="-mt-[15px] flex h-[calc(100dvh-7.25rem)] min-h-[28rem] flex-col sm:h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-6.5rem)]">
      <div className="flex shrink-0 items-center gap-2.5 text-foreground">
        <MessagesSquare
          className="h-5 w-5 text-steel-600 dark:text-steel-400"
          strokeWidth={2}
          aria-hidden
        />
        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Companion
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Ask about sessions, catalog, and community health media
            {user?.firstName ? `, ${user.firstName}` : ''}.
          </p>
        </div>
      </div>

      {banner ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-[6px] border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="text-pretty leading-relaxed">{banner}</p>
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-card border border-border/90 bg-card/60 p-3 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.08)] dark:bg-card/40 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_30px_-16px_rgba(0,0,0,0.45)] sm:p-4"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-steel-100 text-steel-700 dark:bg-steel-600/30 dark:text-steel-200">
              <MessagesSquare className="h-6 w-6" strokeWidth={2} aria-hidden />
            </div>
            <p className="mt-4 text-lg font-bold tracking-tight text-foreground">
              How can Companion help?
            </p>
            <p className="mt-1 max-w-md text-pretty text-sm text-muted-foreground">
              Answers stream from your knowledge base with source links when available.
            </p>
            <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-[6px] border border-border/90 bg-white px-3 py-2 text-left text-sm font-medium text-foreground shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-[background-color,transform] duration-200 hover:bg-steel-50/90 active:scale-[0.98] dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={[
                'flex w-full',
                m.role === 'user' ? 'justify-end' : 'justify-start',
              ].join(' ')}
            >
              <div
                className={[
                  'max-w-[min(100%,42rem)] rounded-card px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_1px_0_rgba(0,0,0,0.04)]',
                  m.role === 'user'
                    ? 'bg-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'border border-border/90 bg-white text-foreground dark:bg-zinc-900',
                ].join(' ')}
              >
                {m.role === 'assistant' && m.citations.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {m.citations.map((c) => (
                      <a
                        key={c.citation_id}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 rounded-[6px] bg-steel-50 px-2 py-1 text-[11px] font-semibold text-steel-800 ring-1 ring-steel-200/80 hover:bg-steel-100 dark:bg-steel-600/25 dark:text-steel-100 dark:ring-steel-500/40"
                        title={c.snippet || c.title}
                      >
                        <span className="truncate">{c.title || c.citation_id}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      </a>
                    ))}
                  </div>
                ) : null}

                {m.warning ? (
                  <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                    {m.warning}
                  </p>
                ) : null}

                <div className={m.role === 'user' ? 'whitespace-pre-wrap' : ''}>
                  {m.role === 'assistant'
                    ? renderAssistantText(m.content, m.citations)
                    : m.content}
                  {m.streaming && !m.content ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Thinking…
                    </span>
                  ) : null}
                  {m.streaming && m.content ? (
                    <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-steel-500 align-middle" />
                  ) : null}
                </div>

                {m.error ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-700 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {m.error}
                  </p>
                ) : null}

                {m.finishReason === 'truncated' ? (
                  <p className="mt-2 text-xs text-muted-foreground">Answer was truncated.</p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="mt-3 shrink-0 rounded-card border border-border/90 bg-card p-2 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_30px_-16px_rgba(0,0,0,0.45)]"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="companion-input" className="sr-only">
          Message Companion
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="companion-input"
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
            placeholder="Ask Companion…"
            className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-border bg-white text-foreground transition-[transform,background-color] duration-200 hover:bg-steel-50 active:scale-[0.96] dark:bg-zinc-900 dark:hover:bg-zinc-800"
              aria-label="Stop generating"
            >
              <Square className="h-4 w-4 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-[background-color,transform] duration-200 hover:bg-brand-700 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
