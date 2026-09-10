import { resolveApiBaseUrl } from '../config/app-urls';

export type CitationEvent = {
  citation_id: string;
  source_id: string;
  chunk_id: string;
  source_type: string;
  title: string;
  url: string;
  playlist_url: string | null;
  snippet: string;
  timestamp: number | null;
};

export type TokenEvent = {
  text: string;
  index: number;
};

export type ErrorEvent = {
  code:
    | 'rate_limited'
    | 'retrieval_failed'
    | 'retrieval_degraded'
    | 'llm_refused'
    | 'llm_timeout'
    | 'internal'
    | 'validation'
    | 'unauthorized'
    | string;
  message: string;
  retryable: boolean;
  retry_after_ms?: number | null;
};

export type DoneEvent = {
  finish_reason: 'complete' | 'truncated' | 'error' | 'cancelled' | string;
  tokens_generated: number;
  citations_emitted: number;
  latency_ms: {
    retrieval: number;
    first_token: number;
    total: number;
  };
  request_id: string;
};

export type ChatHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatRequestBody = {
  query: string;
  conversation_id?: string | null;
  history?: ChatHistoryTurn[];
  options?: {
    max_tokens?: number;
    temperature?: number;
  };
};

export type CompanionErrorEnvelope = {
  error: {
    code: string;
    message: string;
    field?: string | null;
    retry_after_ms?: number | null;
  };
};

export type CompanionStreamHandlers = {
  onCitation: (c: CitationEvent) => void;
  onToken: (t: TokenEvent) => void;
  onError: (e: ErrorEvent) => void;
  onDone: (d: DoneEvent) => void;
};

const TERMINAL_ERROR_CODES = new Set([
  'llm_timeout',
  'llm_refused',
  'internal',
  'validation',
  'unauthorized',
  'rate_limited',
  'retrieval_failed',
]);

export function isTerminalStreamError(code: string): boolean {
  return TERMINAL_ERROR_CODES.has(code);
}

/** Parse an SSE byte stream (named events preferred; shim ignored when named tokens seen). */
export async function consumeCompanionSse(
  body: ReadableStream<Uint8Array>,
  handlers: CompanionStreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  let dataLines: string[] = [];
  let sawNamedToken = false;
  let sawDone = false;

  const flush = () => {
    if (dataLines.length === 0 && eventName === 'message') return;
    const data = dataLines.join('\n');
    const name = eventName;
    dataLines = [];
    eventName = 'message';

    if (!data) return;
    if (data === '[DONE]') return;

    if (name === 'citation') {
      handlers.onCitation(JSON.parse(data) as CitationEvent);
      return;
    }
    if (name === 'token') {
      sawNamedToken = true;
      handlers.onToken(JSON.parse(data) as TokenEvent);
      return;
    }
    if (name === 'error') {
      handlers.onError(JSON.parse(data) as ErrorEvent);
      return;
    }
    if (name === 'done') {
      sawDone = true;
      handlers.onDone(JSON.parse(data) as DoneEvent);
      return;
    }

    // Shim: unnamed data: {"text":"…"} — only if we are not handling named tokens
    if (!sawNamedToken && !sawDone) {
      try {
        const parsed = JSON.parse(data) as { text?: string };
        if (typeof parsed.text === 'string') {
          handlers.onToken({ text: parsed.text, index: -1 });
        }
      } catch {
        // ignore non-JSON shim lines
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '') {
        flush();
        continue;
      }
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message';
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^\s/, ''));
      }
    }
  }
  if (buffer.trim()) {
    const line = buffer;
    if (line.startsWith('event:')) eventName = line.slice(6).trim() || 'message';
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^\s/, ''));
  }
  flush();
}

export async function streamCompanionChat(args: {
  body: ChatRequestBody;
  signal?: AbortSignal;
  handlers: CompanionStreamHandlers;
  getAuthHeaders?: () => Promise<Record<string, string>>;
}): Promise<{ requestId: string | null }> {
  const extraHeaders = (await args.getAuthHeaders?.()) ?? {};
  const res = await fetch(`${resolveApiBaseUrl()}/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...extraHeaders,
    },
    body: JSON.stringify(args.body),
    signal: args.signal,
  });

  const requestId = res.headers.get('X-Request-Id') || res.headers.get('x-request-id');

  if (!res.ok) {
    let envelope: CompanionErrorEnvelope | null = null;
    try {
      envelope = (await res.json()) as CompanionErrorEnvelope;
    } catch {
      // ignore
    }
    const err = envelope?.error ?? {
      code: 'internal',
      message: `Chat request failed (${res.status})`,
    };
    throw Object.assign(new Error(err.message), { code: err.code, status: res.status, retry_after_ms: err.retry_after_ms });
  }

  if (!res.body) {
    throw Object.assign(new Error('Empty chat stream'), { code: 'internal' });
  }

  await consumeCompanionSse(res.body, args.handlers);
  return { requestId };
}
