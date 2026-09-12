import { describe, expect, it } from 'bun:test';
import { configureBusinessSdk, createBusinessClient, orvelt } from '../../src/config.ts';

const apiKeySecurity = [{ in: 'header' as const, name: 'x-api-key', type: 'apiKey' as const }];

describe('Business SDK client configuration', () => {
  it('uses orvelt as the shared-client configuration entry point', () => {
    expect(configureBusinessSdk).toBe(orvelt);
  });

  it('applies the v1 base URL and x-api-key authentication', async () => {
    let capturedRequest: Request | undefined;
    const client = createBusinessClient({
      apiKey: '  ov_test_key  ',
      baseUrl: 'https://example.test/v1/',
      fetch: (async (input: URL | RequestInfo) => {
        capturedRequest = input instanceof Request ? input : new Request(input);
        return Response.json({ success: true });
      }) as typeof fetch,
    });

    const result = await client.get({
      security: apiKeySecurity,
      url: '/project/test/goals',
    });

    expect(result.response?.status).toBe(200);
    expect(capturedRequest?.url).toBe('https://example.test/v1/project/test/goals');
    expect(capturedRequest?.headers.get('x-api-key')).toBe('ov_test_key');
    expect(capturedRequest?.headers.has('authorization')).toBe(false);
  });

  it('rejects blank credentials before issuing a request', () => {
    expect(() => createBusinessClient({ apiKey: '   ' })).toThrow(
      'apiKey must be a non-empty string.',
    );
  });
});
