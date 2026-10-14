/**
 * Incremental parser for the companion SSE stream. Collects the answer text,
 * citation payloads, and finish reason while the raw bytes are piped to the
 * browser unchanged.
 */
export class SseAccumulator {
  private readonly decoder = new TextDecoder();
  private buffer = '';
  private eventName = 'message';
  private dataLines: string[] = [];
  private readonly namedTokens: string[] = [];
  private readonly shimTokens: string[] = [];
  private sawNamedToken = false;
  private ended = false;

  readonly citations: Record<string, unknown>[] = [];
  finishReason: string | null = null;

  push(chunk: Uint8Array): void {
    if (this.ended) return;
    this.buffer += this.decoder.decode(chunk, { stream: true });
    this.drainLines();
  }

  /** Flushes any trailing partial event. Safe to call more than once. */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.buffer += this.decoder.decode();
    this.drainLines();
    if (this.buffer) {
      this.handleLine(this.buffer);
      this.buffer = '';
    }
    this.flush();
  }

  /** Named `token` events win; unnamed `data: {"text"}` frames are a fallback. */
  get content(): string {
    return (this.sawNamedToken ? this.namedTokens : this.shimTokens).join('');
  }

  private drainLines(): void {
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) this.handleLine(line);
  }

  private handleLine(line: string): void {
    if (line === '') {
      this.flush();
      return;
    }
    if (line.startsWith(':')) return;
    if (line.startsWith('event:')) {
      this.eventName = line.slice(6).trim() || 'message';
      return;
    }
    if (line.startsWith('data:')) {
      this.dataLines.push(line.slice(5).replace(/^\s/, ''));
    }
  }

  private flush(): void {
    const name = this.eventName;
    const data = this.dataLines.join('\n');
    this.eventName = 'message';
    this.dataLines = [];
    if (!data || data === '[DONE]') return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    const payload = parsed as Record<string, unknown>;

    if (name === 'token') {
      this.sawNamedToken = true;
      if (typeof payload.text === 'string') this.namedTokens.push(payload.text);
      return;
    }
    if (name === 'citation') {
      this.citations.push(payload);
      return;
    }
    if (name === 'done') {
      if (typeof payload.finish_reason === 'string') {
        this.finishReason = payload.finish_reason;
      }
      return;
    }
    if (name === 'message' && typeof payload.text === 'string') {
      this.shimTokens.push(payload.text);
    }
  }
}
