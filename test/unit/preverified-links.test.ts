import { describe, expect, it } from 'bun:test';
import { link, useProject } from '../../src/index.ts';
import { createBusinessClient } from '../../src/config.ts';

const projectId = '00000000-0000-0000-0000-000000000000';
const token = '11111111-1111-4111-8111-111111111111';

describe('preverified-link creation', () => {
  for (const sendEmail of [undefined, true, false]) {
    it(`uses the unified endpoint with sendEmail=${String(sendEmail)}`, async () => {
      let capturedRequest: Request | undefined;
      const emailedAt = sendEmail === false ? null : '2026-10-11T00:00:00.000Z';
      const client = createBusinessClient({
        apiKey: 'ov_test_key',
        baseUrl: 'https://example.test/v1',
        fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
          capturedRequest = new Request(input, init);
          return Response.json({
            token,
            verificationId: 'AAAAAAAAAAAAAAAAAAAAA',
            projectId,
            customerEmail: 'customer@example.com',
            customerFirstName: 'Alex',
            validityMinutes: 10080,
            ttlSeconds: 604800,
            expiresAt: '2026-10-18T00:00:00.000Z',
            link: `https://example.test/opinion#preverify=${token}`,
            emailedAt,
          });
        }) as typeof fetch,
      });
      const parameters = {
        customerEmail: 'customer@example.com',
        customerFirstName: 'Alex',
        customerReference: 'crm-42',
        ...(sendEmail === undefined ? {} : { sendEmail }),
      };
      const result = await useProject(projectId).link.create(parameters, { client });

      expect(result.error).toBeUndefined();
      expect(result.data?.emailedAt).toBe(emailedAt);
      expect(capturedRequest?.method).toBe('POST');
      expect(capturedRequest?.url).toBe(`https://example.test/v1/project/${projectId}/link`);
      expect(await capturedRequest?.clone().json()).toEqual(parameters);
    });
  }

  it('has no separate sendEmail operation', () => {
    expect(Object.keys(link)).toEqual(['list', 'create', 'resend']);
    expect(Object.keys(useProject(projectId).link)).toEqual(['list', 'create', 'resend']);
  });
});
