import { describe, expect, it } from 'bun:test';
import { Orvelt } from '../../src/index.ts';

const projectId = '00000000-0000-0000-0000-000000000000';
const token = '11111111-1111-4111-8111-111111111111';

describe('preverified-link creation', () => {
  for (const notify of [undefined, true, false]) {
    it(`uses the unified endpoint with notify=${String(notify)}`, async () => {
      let capturedRequest: Request | undefined;
      const notifiedAt = notify === false ? null : '2026-10-11T00:00:00.000Z';
      const orvelt = new Orvelt({
        apiKey: 'ov_test_key',
        baseUrl: 'https://example.test/v1',
        fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
          capturedRequest = new Request(input, init);
          return Response.json({
            id: token,
            token,
            verificationId: '7KQM3XHA9TPVW2RD',
            type: 'invite',
            status: 'issued',
            notify: notify ?? true,
            projectId,
            email: 'customer@example.com',
            firstName: 'Alex',
            purchase: null,
            validityMinutes: 10080,
            ttlSeconds: 604800,
            expiresAt: '2026-10-18T00:00:00.000Z',
            link: `https://example.test/opinion#preverify=${token}`,
            notifiedAt,
          });
        }) as typeof fetch,
      });
      const parameters = {
        email: 'customer@example.com',
        firstName: 'Alex',
        reference: 'crm-42',
        ...(notify === undefined ? {} : { notify }),
      };
      const result = await orvelt.link.create({ projectId, ...parameters });

      expect(result.error).toBeUndefined();
      expect(result.data?.notifiedAt).toBe(notifiedAt);
      expect(capturedRequest?.method).toBe('POST');
      expect(capturedRequest?.url).toBe(`https://example.test/v1/project/${projectId}/link`);
      expect(await capturedRequest?.clone().json()).toEqual(parameters);
    });
  }

  it('has no separate notify operation', () => {
    const { link } = new Orvelt('ov_test_key');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(link));
    expect(methods.filter((name) => name !== 'constructor').toSorted()).toEqual([
      'create',
      'list',
      'resend',
    ]);
  });
});
