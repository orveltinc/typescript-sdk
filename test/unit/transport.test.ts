import { describe, expect, it } from 'bun:test';
import { ZodError } from 'zod';
import {
  createBusinessClient,
  questions,
  subscribers,
  useProject,
  type SubscribersCountResponse,
} from '../../src/index.ts';

const projectId = '019a0000-0000-7000-8000-000000000001';
const questionId = '019a0000-0000-7000-8000-000000000002';
const question = {
  id: questionId,
  familyId: questionId,
  version: 1,
  question: 'How was your visit?',
  answerMode: 'text_only' as const,
  answers: { skippable: false, freeTextMultiline: false },
  tags: ['Trust' as const],
  priority: 1,
  isAutoPriority: true,
  isAutoTags: false,
  status: 'active' as const,
  responseVisibility: 'default' as const,
  createdAt: '2026-10-11T00:00:00.000Z',
};

function responseClient(respond: (request: Request) => Response | Promise<Response>) {
  return createBusinessClient({
    apiKey: 'ov_transport_test',
    baseUrl: 'https://example.test/v1',
    fetch: (async (input: URL | RequestInfo, init?: RequestInit) =>
      respond(new Request(input, init))) as typeof fetch,
  });
}

describe('generated REST transport', () => {
  for (const headers of [
    { 'x-request-id': 'custom' },
    new Headers({ 'x-request-id': 'custom' }),
    [['x-request-id', 'custom']] as [string, string][],
  ]) {
    it(`preserves ${headers.constructor.name} request headers on POST and PATCH`, async () => {
      const requests: Request[] = [];
      const client = responseClient((request) => {
        requests.push(request);
        return Response.json({ question });
      });
      const {
        id: _id,
        familyId: _familyId,
        version: _version,
        createdAt: _createdAt,
        ...body
      } = question;
      const updateBody = { priority: 60, status: 'active' as const };
      const created = await questions.create({ projectId, ...body }, { client, headers });
      const updated = await questions.update(
        { projectId, questionId, ...updateBody },
        { client, headers },
      );
      expect(created.error).toBeUndefined();
      expect(updated.error).toBeUndefined();
      expect(created.data?.question.createdAt).toBe(question.createdAt);
      expect(requests.map((request) => request.method)).toEqual(['POST', 'PATCH']);
      for (const [index, request] of requests.entries()) {
        expect(request.headers.get('x-request-id')).toBe('custom');
        expect(request.headers.get('x-api-key')).toBe('ov_transport_test');
        expect(request.headers.get('content-type')).toBe('application/json');
        expect(await request.json()).toEqual(index === 0 ? body : updateBody);
      }
    });
  }

  it('keeps record null values as deletions, including Content-Type', async () => {
    let captured: Request | undefined;
    const client = responseClient((request) => {
      captured = request;
      return Response.json({ question });
    });
    client.setConfig({ headers: { 'x-remove': 'old', 'x-keep': 'retained' } });
    const result = await questions.update(
      { projectId, questionId, priority: 60 },
      {
        client,
        headers: { 'x-remove': null, 'Content-Type': null },
      },
    );
    expect(result.error).toBeUndefined();
    expect(captured?.headers.has('x-remove')).toBe(false);
    // Fetch may infer text/plain for the serialized string, but must not restore application/json.
    expect(captured?.headers.get('content-type')).not.toBe('application/json');
    expect(captured?.headers.get('x-keep')).toBe('retained');
  });

  it('combines repeated tuple headers using native Headers semantics on GET and PATCH', async () => {
    const requests: Request[] = [];
    const client = responseClient((request) => {
      requests.push(request);
      return Response.json(request.method === 'GET' ? { total: 0, delta: 0 } : { question });
    });
    const headers: [string, string][] = [
      ['x-values', 'one'],
      ['x-values', 'two'],
    ];
    await subscribers.count({ projectId }, { client, headers });
    await questions.update({ projectId, questionId, priority: 60 }, { client, headers });
    expect(requests.map((request) => request.headers.get('x-values'))).toEqual([
      'one, two',
      'one, two',
    ]);
  });

  it('rejects malformed successful JSON instead of exposing invalid typed data', async () => {
    const client = responseClient(() => Response.json({ total: 'not a number', delta: 0 }));
    const result = await subscribers.count({ projectId }, { client });
    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(ZodError);
    expect(result.response?.status).toBe(200);
    await expect(
      subscribers.count({ projectId }, { client, throwOnError: true }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('preserves throwOnError inference through the project facade', async () => {
    const client = responseClient(() => Response.json({ total: 1, delta: -1 }));
    const result = await useProject(projectId).subscribers.count({ client, throwOnError: true });
    // This assignment also verifies that the facade does not widen the generic to boolean.
    const data: SubscribersCountResponse = result.data;
    expect(data).toEqual({ total: 1, delta: -1 });
  });

  for (const [status, code, data] of [
    [
      403,
      'PLAN_LIMIT_REACHED',
      { metric: 'activeQuestionsPerProject', currentUsage: 10, limit: 10, upgradePath: '/billing' },
    ],
    [429, 'LINK_EMAIL_COOLDOWN', { nextEligibleAt: '2026-10-11T01:00:00.000Z' }],
  ] as const) {
    it(`returns and throws the original ${code} payload without retrying a mutation`, async () => {
      let calls = 0;
      const error = { defined: true, code, status, message: 'Try later.', data };
      const client = responseClient(() => {
        calls++;
        return Response.json(error, { status, headers: { 'retry-after': '60' } });
      });
      const result = await questions.delete({ projectId, questionId }, { client });
      expect(result.data).toBeUndefined();
      expect<unknown>(result.error).toEqual(error);
      expect(result.response?.headers.get('retry-after')).toBe('60');
      expect(calls).toBe(1);
      await expect(
        questions.delete({ projectId, questionId }, { client, throwOnError: true }),
      ).rejects.toEqual(error);
      expect(calls).toBe(2);
    });
  }

  it('returns network errors without assuming a response exists', async () => {
    const error = new TypeError('Network unavailable');
    const client = responseClient(() => Promise.reject(error));
    const result = await subscribers.count({ projectId }, { client });
    expect<unknown>(result.error).toBe(error);
    expect(result.request).toBeInstanceOf(Request);
    expect(result.response).toBeUndefined();
    await expect(subscribers.count({ projectId }, { client, throwOnError: true })).rejects.toBe(
      error,
    );
  });

  it('passes cancellation signals to the transport', async () => {
    const controller = new AbortController();
    controller.abort();
    const client = responseClient((request) => {
      request.signal.throwIfAborted();
      return Response.json({ total: 0, delta: 0 });
    });
    const result = await subscribers.count({ projectId }, { client, signal: controller.signal });
    expect(result.error).toBe(controller.signal.reason);
    expect(result.response).toBeUndefined();
  });
});
