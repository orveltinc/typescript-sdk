import { describe, expect, it } from 'bun:test';
import { answers, opinions, qr, useProject } from '../../src/index.ts';
import { createBusinessClient } from '../../src/config.ts';

const projectId = '01920000-0000-7000-8000-000000000001';
const reviewId = '01920000-0000-7000-8000-000000000002';
const questionId = '01920000-0000-7000-8000-000000000003';

describe('feed filter request serialization', () => {
  for (const resource of ['answers', 'opinions'] as const) {
    it(`passes every ${resource} filter as an encoded REST query parameter`, async () => {
      let captured: Request | undefined;
      const client = createBusinessClient({
        apiKey: 'ov_test_key',
        fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
          captured = new Request(input, init);
          return Response.json({
            [resource]: [],
            pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
          });
        }) as typeof fetch,
      });
      const common = {
        projectId,
        [resource === 'answers' ? 'responseId' : 'opinionId']: reviewId,
        query: 'service & delivery',
        externalUserId: 'customer+42@example.com',
        dateFrom: 0,
        dateTo: 2000,
        page: 2,
        limit: 5,
      };
      const result =
        resource === 'answers'
          ? await answers.list(
              { ...common, questionId, responseVisibility: 'private', sort: 'oldest' },
              { client },
            )
          : await opinions.list(
              {
                ...common,
                visibility: 'private',
                replyStatus: 'unreplied',
                sort: 'most-upvoted',
              },
              { client },
            );
      expect(result.error).toBeUndefined();
      expect(captured?.method).toBe('GET');
      expect(captured?.headers.get('x-api-key')).toBe('ov_test_key');
      if (!captured) throw new Error('SDK did not issue a request.');
      const url = new URL(captured.url);
      expect(url.pathname).toBe(`/v1/project/${projectId}/${resource}`);
      for (const [key, value] of Object.entries(common)) {
        if (key !== 'projectId') expect(url.searchParams.get(key)).toBe(String(value));
      }
      if (resource === 'answers') {
        expect(url.searchParams.get('questionId')).toBe(questionId);
        expect(url.searchParams.get('responseVisibility')).toBe('private');
      } else {
        expect(url.searchParams.get('visibility')).toBe('private');
        expect(url.searchParams.get('replyStatus')).toBe('unreplied');
      }
    });
  }

  it('uses the simple resend endpoint with a scoped project', async () => {
    let captured: Request | undefined;
    const client = createBusinessClient({
      apiKey: 'ov_test_key',
      fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
        captured = new Request(input, init);
        return Response.json({
          emailedAt: '2026-10-15T00:00:00.000Z',
          nextEmailAt: '2026-10-17T00:00:00.000Z',
        });
      }) as typeof fetch,
    });
    const result = await useProject(projectId).link.resend({ id: reviewId }, { client });
    expect(result.error).toBeUndefined();
    expect(captured?.method).toBe('POST');
    if (!captured) throw new Error('SDK did not issue a request.');
    expect(new URL(captured.url).pathname).toBe(`/v1/project/${projectId}/link/${reviewId}/resend`);
  });

  it('counts subscribers with no list endpoint', async () => {
    let captured: Request | undefined;
    const client = createBusinessClient({
      apiKey: 'ov_test_key',
      fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
        captured = new Request(input, init);
        return Response.json({ total: 4, delta: 2 });
      }) as typeof fetch,
    });
    const result = await useProject(projectId).subscribers.count({ client });
    expect(result.data).toEqual({ total: 4, delta: 2 });
    if (!captured) throw new Error('SDK did not issue a request.');
    expect(new URL(captured.url).pathname).toBe(`/v1/project/${projectId}/subscribers/count`);
  });

  it('displays a rotating QR code through the simple display endpoint', async () => {
    let captured: Request | undefined;
    const now = '2026-10-15T00:00:00.000Z';
    const client = createBusinessClient({
      apiKey: 'ov_test_key',
      fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
        captured = new Request(input, init);
        return Response.json({
          qrCode: {
            id: 'AAAAAAAAAAAAAAAAAAAAA',
            projectId,
            mode: 'rotating',
            credentialGeneration: 1,
            rotationPeriodSeconds: 300,
            revokedAt: null,
            createdAt: now,
            updatedAt: now,
          },
          link: 'https://orvelt.com/stores/example/opinion#qr=credential',
          serverTime: now,
          validFrom: now,
          validUntil: '2026-10-15T00:05:00.000Z',
        });
      }) as typeof fetch,
    });
    const result = await qr.display({ projectId }, { client });
    expect(result.error).toBeUndefined();
    expect(result.data?.qrCode.mode).toBe('rotating');
    expect(captured?.method).toBe('POST');
    if (!captured) throw new Error('SDK did not issue a request.');
    expect(new URL(captured.url).pathname).toBe(`/v1/project/${projectId}/qr/display`);
  });
});
