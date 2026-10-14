import { describe, expect, it, vi } from 'vitest';
import { consumeCompanionSse, dedupeCitationsBySource } from '../../api/companionChat';

function streamFrom(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe('consumeCompanionSse', () => {
  it('handles named citation, token, and done events', async () => {
    const onCitation = vi.fn();
    const onToken = vi.fn();
    const onError = vi.fn();
    const onDone = vi.fn();

    const payload = [
      'event: citation',
      'data: {"citation_id":"c1","source_id":"s1","chunk_id":"k1","source_type":"curated_doc","title":"Hello","url":"https://example.com","playlist_url":null,"snippet":"…","timestamp":null}',
      '',
      'event: token',
      'data: {"text":"Hi ","index":0}',
      '',
      'data: {"text":"Hi "}',
      '',
      'event: token',
      'data: {"text":"there","index":1}',
      '',
      'event: done',
      'data: {"finish_reason":"complete","tokens_generated":2,"citations_emitted":1,"latency_ms":{"retrieval":1,"first_token":2,"total":3},"request_id":"01H"}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    await consumeCompanionSse(streamFrom(payload), {
      onCitation,
      onToken,
      onError,
      onDone,
    });

    expect(onCitation).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken.mock.calls.map((c) => c[0].text).join('')).toBe('Hi there');
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ finish_reason: 'complete', request_id: '01H' }),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('emits the conversation event before tokens', async () => {
    const order: string[] = [];
    await consumeCompanionSse(
      streamFrom(
        'event: conversation\ndata: {"conversation_id":"conv-1"}\n\nevent: token\ndata: {"text":"x","index":0}\n\n',
      ),
      {
        onConversation: (c) => order.push(`conversation:${c.conversation_id}`),
        onCitation: vi.fn(),
        onToken: (t) => order.push(`token:${t.text}`),
        onError: vi.fn(),
        onDone: vi.fn(),
      },
    );
    expect(order).toEqual(['conversation:conv-1', 'token:x']);
  });
});

describe('dedupeCitationsBySource', () => {
  it('keeps one citation per source_id in first-seen order', () => {
    const base = {
      chunk_id: 'k',
      source_type: 'catalog_clip',
      title: 't',
      url: 'https://example.com',
      playlist_url: null,
      snippet: '',
      timestamp: null,
    };
    const result = dedupeCitationsBySource([
      { ...base, citation_id: 'c1', source_id: 's1' },
      { ...base, citation_id: 'c2', source_id: 's2' },
      { ...base, citation_id: 'c3', source_id: 's1' },
    ]);
    expect(result.map((c) => c.citation_id)).toEqual(['c1', 'c2']);
  });
});
