import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import type { AuthUser } from '../../auth/auth.service';
import type { CognitoM2mTokenService } from '../../auth/cognito-m2m-token.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { CompanionService, conversationTitle } from './companion.service';

type Json = Record<string, unknown>;

class FakeResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  body: Json | null = null;
  chunks: string[] = [];
  headersSent = false;
  writableEnded = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(payload: Json) {
    this.body = payload;
    this.headersSent = true;
    this.writableEnded = true;
    return this;
  }
  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  flushHeaders() {
    this.headersSent = true;
  }
  write(chunk: string | Uint8Array) {
    this.chunks.push(
      typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'),
    );
    return true;
  }
  end() {
    this.writableEnded = true;
  }
}

const user: AuthUser = {
  userId: 'user-1',
  role: 'USER',
} as unknown as AuthUser;

function makePrisma() {
  return {
    companionConversation: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'conv-new' }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    companionMessage: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeTokens(...tokens: string[]) {
  const queue = tokens.length ? [...tokens] : ['tok-1'];
  return {
    getAccessToken: jest.fn(() =>
      Promise.resolve(queue.length > 1 ? queue.shift()! : queue[0]),
    ),
    invalidate: jest.fn(),
  };
}

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  tokens: ReturnType<typeof makeTokens> = makeTokens(),
) {
  const config = {
    get: (key: string) =>
      ({
        'companion.baseUrl': 'http://companion:8080',
        'companion.m2mScope': 'companion/chat.invoke',
      })[key],
  } as unknown as ConfigService;
  return new CompanionService(
    config,
    prisma as unknown as PrismaService,
    tokens as unknown as CognitoM2mTokenService,
  );
}

function sentHeaders(fetchMock: jest.Mock, call = 0): Record<string, string> {
  const [, init] = fetchMock.mock.calls[call] as [
    string,
    { headers: Record<string, string> },
  ];
  return init.headers;
}

const SSE =
  'event: citation\ndata: {"citation_id":"c1","source_id":"s1"}\n\n' +
  'event: token\ndata: {"text":"Hi"}\n\n' +
  'event: done\ndata: {"finish_reason":"complete"}\n\n';

describe('CompanionService', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(
      new Response(SSE, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('creates a conversation, streams it back, and saves both turns', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const res = new FakeResponse();

    await service.proxyChat(
      { query: '  What   is CHM?  ' },
      user,
      'req-1',
      new EventEmitter() as unknown as Request,
      res as unknown as Response,
    );

    expect(prisma.companionConversation.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', title: 'What is CHM?' },
      select: { id: true },
    });
    expect(prisma.companionMessage.create).toHaveBeenNthCalledWith(1, {
      data: {
        conversationId: 'conv-new',
        role: 'user',
        content: '  What   is CHM?  ',
      },
    });
    expect(prisma.companionMessage.create).toHaveBeenNthCalledWith(2, {
      data: {
        conversationId: 'conv-new',
        role: 'assistant',
        content: 'Hi',
        citations: [{ citation_id: 'c1', source_id: 's1' }],
        finishReason: 'complete',
      },
    });
    expect(prisma.companionConversation.update).toHaveBeenCalled();
    expect(res.headers['X-Conversation-Id']).toBe('conv-new');
    expect(res.chunks[0]).toBe(
      'event: conversation\ndata: {"conversation_id":"conv-new"}\n\n',
    );
    expect(res.chunks.slice(1).join('')).toBe(SSE);
  });

  it('sends stored history oldest first and ignores client history', async () => {
    const prisma = makePrisma();
    prisma.companionConversation.findFirst.mockResolvedValue({
      id: 'conv-1',
    });
    prisma.companionMessage.findMany.mockResolvedValue([
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'first' },
    ]);
    const service = makeService(prisma);

    await service.proxyChat(
      {
        query: 'follow up',
        conversation_id: 'conv-1',
        history: [{ role: 'user', content: 'forged' }],
      },
      user,
      'req-2',
      new EventEmitter() as unknown as Request,
      new FakeResponse() as unknown as Response,
    );

    expect(prisma.companionConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv-1', userId: 'user-1' },
      select: { id: true },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const sent = JSON.parse(init.body) as Json;
    expect(sent.conversation_id).toBe('conv-1');
    expect(sent.history).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
    ]);
  });

  it('authenticates with a companion/chat.invoke Bearer and keeps caller headers', async () => {
    const prisma = makePrisma();
    const tokens = makeTokens('tok-1');
    const service = makeService(prisma, tokens);

    await service.proxyChat(
      { query: 'hi' },
      user,
      'req-auth',
      new EventEmitter() as unknown as Request,
      new FakeResponse() as unknown as Response,
    );

    expect(tokens.getAccessToken).toHaveBeenCalledWith('companion/chat.invoke');
    const headers = sentHeaders(fetchMock);
    expect(headers.Authorization).toBe('Bearer tok-1');
    expect(headers['X-BFF-Auth']).toBeUndefined();
    expect(headers).toMatchObject({
      'X-User-Id': 'user-1',
      'X-User-Role': 'member',
      'X-Request-Id': 'req-auth',
      'X-Client': 'web',
    });
  });

  it('on a 401 drops the cached token and retries once with a fresh one', async () => {
    const prisma = makePrisma();
    const tokens = makeTokens('stale', 'fresh');
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(SSE, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );
    const service = makeService(prisma, tokens);
    const res = new FakeResponse();

    await service.proxyChat(
      { query: 'hi' },
      user,
      'req-401',
      new EventEmitter() as unknown as Request,
      res as unknown as Response,
    );

    expect(tokens.invalidate).toHaveBeenCalledWith('companion/chat.invoke');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentHeaders(fetchMock, 0).Authorization).toBe('Bearer stale');
    expect(sentHeaders(fetchMock, 1).Authorization).toBe('Bearer fresh');
    expect(res.statusCode).toBe(200);
    expect(res.chunks.slice(1).join('')).toBe(SSE);
  });

  it('passes a second 401 through instead of retrying again', async () => {
    const prisma = makePrisma();
    fetchMock.mockReset().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'unauthorized' } }), {
          status: 401,
        }),
      ),
    );
    const service = makeService(prisma);
    const res = new FakeResponse();

    await service.proxyChat(
      { query: 'hi' },
      user,
      'req-401x2',
      new EventEmitter() as unknown as Request,
      res as unknown as Response,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(401);
  });

  it('returns 503 without calling the companion when no token can be minted', async () => {
    const prisma = makePrisma();
    const tokens = makeTokens();
    tokens.getAccessToken.mockRejectedValue(new Error('not configured'));
    const service = makeService(prisma, tokens);
    const res = new FakeResponse();

    await service.proxyChat(
      { query: 'hi' },
      user,
      'req-notoken',
      new EventEmitter() as unknown as Request,
      res as unknown as Response,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
  });

  it('returns 404 for another user’s conversation without calling the companion', async () => {
    const prisma = makePrisma();
    prisma.companionConversation.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);
    const res = new FakeResponse();

    await service.proxyChat(
      { query: 'hi', conversation_id: 'someone-elses' },
      user,
      'req-3',
      new EventEmitter() as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      error: { code: 'not_found', field: 'conversation_id' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.companionMessage.create).not.toHaveBeenCalled();
  });

  it('deleteConversation only deletes the user’s own conversation', async () => {
    const prisma = makePrisma();
    prisma.companionConversation.deleteMany.mockResolvedValueOnce({
      count: 1,
    });
    const service = makeService(prisma);

    await service.deleteConversation('user-1', 'conv-1');
    expect(prisma.companionConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'conv-1', userId: 'user-1' },
    });

    prisma.companionConversation.deleteMany.mockResolvedValueOnce({
      count: 0,
    });
    await expect(
      service.deleteConversation('user-1', 'other-users-conv'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds titles from the first question, capped with an ellipsis', () => {
    expect(conversationTitle('a\n\n b')).toBe('a b');
    const long = conversationTitle('x'.repeat(200));
    expect(long).toHaveLength(80);
    expect(long.endsWith('…')).toBe(true);
  });
});
