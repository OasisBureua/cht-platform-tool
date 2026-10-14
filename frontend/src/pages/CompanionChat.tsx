import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowUp,
  ExternalLink,
  FileText,
  Loader2,
  MessagesSquare,
  PlayCircle,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isCompanionEnabled } from '../config/app-urls';
import {
  companionConversationsApi,
  dedupeCitationsBySource,
  isTerminalStreamError,
  streamCompanionChat,
  type CitationEvent,
  type ConversationDetail,
  type DoneEvent,
  type ErrorEvent,
} from '../api/companionChat';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Every citation event (per chunk) so inline [cN] markers resolve. */
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

const CONVERSATIONS_KEY = ['companion', 'conversations'] as const;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Same-origin URLs (catalog clips, site pages) route in-app; returns null for external links. */
function internalPath(url: string): string | null {
  try {
    const u = new URL(url, window.location.href);
    if (u.origin !== window.location.origin) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

function CitationLink({
  url,
  className,
  title,
  children,
}: {
  url: string;
  className: string;
  title?: string;
  children: ReactNode;
}) {
  const path = internalPath(url);
  if (path) {
    return (
      <Link to={path} className={className} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} title={title}>
      {children}
    </a>
  );
}

function CitationTypeIcon({ sourceType }: { sourceType: string }) {
  if (sourceType === 'catalog_clip' || sourceType === 'youtube_caption') {
    return <PlayCircle className="h-3 w-3 shrink-0 opacity-70" aria-hidden />;
  }
  if (sourceType === 'curated_doc') {
    return <FileText className="h-3 w-3 shrink-0 opacity-70" aria-hidden />;
  }
  return null;
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
      <CitationLink
        key={i}
        url={cite.url}
        className="mx-0.5 inline-flex items-center rounded-[4px] bg-steel-100 px-1 py-0.5 text-[11px] font-semibold text-steel-800 underline-offset-2 hover:underline dark:bg-steel-600/40 dark:text-steel-100"
        title={cite.title}
      >
        {part}
      </CitationLink>
    );
  });
}

function toChatMessages(detail: ConversationDetail): ChatMessage[] {
  return detail.messages.map((m) => ({
    id: m.id,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
    citations: Array.isArray(m.citations) ? m.citations : [],
    streaming: false,
    error: null,
    warning: null,
    finishReason: m.finishReason,
  }));
}

export default function CompanionChat() {
  const { user, getAuthHeaders, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const companionEnabled = isCompanionEnabled();
  const conversationsQuery = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: companionConversationsApi.list,
    enabled: companionEnabled && isAuthenticated,
  });
  const conversations = conversationsQuery.data ?? [];

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

  if (!companionEnabled) {
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

  const refreshConversations = () => {
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
  };

  const abortStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const stop = () => {
    abortStream();
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false, finishReason: 'cancelled' } : m)),
    );
  };

  const startNewChat = () => {
    abortStream();
    setMessages([]);
    setConversationId(null);
    setBanner(null);
    inputRef.current?.focus();
  };

  const openConversation = async (id: string) => {
    if (id === conversationId && !busy) return;
    abortStream();
    setBanner(null);
    setLoadingConversation(true);
    try {
      const detail = await companionConversationsApi.get(id);
      setConversationId(detail.id);
      setMessages(toChatMessages(detail));
    } catch {
      setBanner('Could not load that conversation.');
    } finally {
      setLoadingConversation(false);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await companionConversationsApi.remove(id);
      if (id === conversationId) startNewChat();
    } catch {
      setBanner('Could not delete that conversation.');
    } finally {
      refreshConversations();
    }
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

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBusy(true);

    const abort = new AbortController();
    abortRef.current = abort;

    let terminal = false;

    try {
      await streamCompanionChat({
        body: { query, conversation_id: conversationId },
        signal: abort.signal,
        getAuthHeaders,
        handlers: {
          onConversation: (c) => {
            setConversationId(c.conversation_id);
            refreshConversations();
          },
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
      refreshConversations();
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
    <div className="-mt-[15px] flex h-[calc(100dvh-7.25rem)] min-h-[28rem] gap-4 sm:h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-6.5rem)]">
      <aside
        aria-label="Conversations"
        className="hidden w-64 shrink-0 flex-col rounded-card border border-border/90 bg-card p-2 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_30px_-16px_rgba(0,0,0,0.45)] lg:flex"
      >
        <button
          type="button"
          onClick={startNewChat}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] bg-brand-600 px-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-[background-color,transform] duration-200 hover:bg-brand-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New chat
        </button>
        <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {conversationsQuery.isLoading ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No conversations yet.</p>
          ) : (
            conversations.map((c) => {
              const active = c.id === conversationId;
              return (
                <div
                  key={c.id}
                  className={[
                    'group flex items-center gap-1 rounded-[6px]',
                    active ? 'bg-steel-100 dark:bg-steel-600/30' : 'hover:bg-steel-50 dark:hover:bg-zinc-800',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => void openConversation(c.id)}
                    aria-current={active ? 'true' : undefined}
                    className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm text-foreground"
                    title={c.title}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteConversation(c.id)}
                    aria-label={`Delete conversation: ${c.title}`}
                    className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground opacity-0 transition-opacity hover:bg-steel-100 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2.5 text-foreground">
          <MessagesSquare
            className="h-5 w-5 text-steel-600 dark:text-steel-400"
            strokeWidth={2}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Companion
            </h1>
            <p className="text-pretty text-sm text-muted-foreground">
              Ask about sessions, catalog, and community health media
              {user?.firstName ? `, ${user.firstName}` : ''}.
            </p>
          </div>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[6px] border border-border bg-white px-3 text-sm font-semibold text-foreground transition-[background-color,transform] duration-200 hover:bg-steel-50 active:scale-[0.98] dark:bg-zinc-900 dark:hover:bg-zinc-800 lg:hidden"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New chat
            </button>
          ) : null}
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
          {loadingConversation ? (
            <div className="flex h-full min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Loading conversation…
            </div>
          ) : messages.length === 0 ? (
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
            messages.map((m) => {
              const chips = m.role === 'assistant' ? dedupeCitationsBySource(m.citations) : [];
              return (
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

                    {chips.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {chips.map((c) => (
                          <CitationLink
                            key={c.source_id || c.citation_id}
                            url={c.url}
                            className="inline-flex max-w-full items-center gap-1 rounded-[6px] bg-steel-50 px-2 py-1 text-[11px] font-semibold text-steel-800 ring-1 ring-steel-200/80 hover:bg-steel-100 dark:bg-steel-600/25 dark:text-steel-100 dark:ring-steel-500/40"
                            title={c.snippet || c.title}
                          >
                            <CitationTypeIcon sourceType={c.source_type} />
                            <span className="truncate">{c.title || c.citation_id}</span>
                            {internalPath(c.url) ? null : (
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            )}
                          </CitationLink>
                        ))}
                      </div>
                    ) : null}

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
              );
            })
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
              disabled={busy || loadingConversation}
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
                disabled={!draft.trim() || loadingConversation}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-[background-color,transform] duration-200 hover:bg-brand-700 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
