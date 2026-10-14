import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import type { AuthUser } from '../../auth/auth.service';
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

function makeService(prisma: ReturnType<typeof makePrisma>) {
  const config = {
    get: (key: string) =>
      ({
        'companion.baseUrl': 'http://companion:8080',
        'companion.internalSecret': 's3cret',
      })[key],
  } as unknown as ConfigService;
  return new CompanionService(config, prisma as unknown as PrismaService);
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
