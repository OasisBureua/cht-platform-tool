import { SseAccumulator } from './sse-accumulator';

const enc = new TextEncoder();

function feed(acc: SseAccumulator, ...chunks: (string | Uint8Array)[]) {
  for (const c of chunks) acc.push(typeof c === 'string' ? enc.encode(c) : c);
  acc.end();
}

describe('SseAccumulator', () => {
  it('joins named tokens split across chunks and collects citations + finish reason', () => {
    const acc = new SseAccumulator();
    feed(
      acc,
      'event: citation\ndata: {"citation_id":"c1","source_id":"s1"}\n\n',
      'event: token\ndata: {"text":"Hel',
      'lo","index":0}\n\nevent: tok',
      'en\ndata: {"text":" world","index":1}\n\n',
      ': keep-alive\n\n',
      'event: done\ndata: {"finish_reason":"complete"}\n\n',
      'data: [DONE]\n\n',
    );
    expect(acc.content).toBe('Hello world');
    expect(acc.citations).toEqual([{ citation_id: 'c1', source_id: 's1' }]);
    expect(acc.finishReason).toBe('complete');
  });

  it('falls back to unnamed shim frames only when no named tokens were seen', () => {
    const shimOnly = new SseAccumulator();
    feed(shimOnly, 'data: {"text":"a"}\n\ndata: {"text":"b"}\n\n');
    expect(shimOnly.content).toBe('ab');

    const mixed = new SseAccumulator();
    feed(
      mixed,
      'data: {"text":"shim"}\n\n',
      'event: token\ndata: {"text":"named"}\n\n',
    );
    expect(mixed.content).toBe('named');
  });

  it('decodes multi-byte characters split across chunks', () => {
    const bytes = enc.encode('event: token\ndata: {"text":"café ✓"}\n\n');
    const splitAt = bytes.indexOf(0xc3) + 1;
    const acc = new SseAccumulator();
    feed(acc, bytes.slice(0, splitAt), bytes.slice(splitAt));
    expect(acc.content).toBe('café ✓');
  });

  it('flushes a trailing event without a blank line and ignores a second end()', () => {
    const acc = new SseAccumulator();
    acc.push(enc.encode('event: token\r\ndata: {"text":"tail"}'));
    acc.end();
    acc.end();
    expect(acc.content).toBe('tail');
  });
});
