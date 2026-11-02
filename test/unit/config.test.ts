import { afterEach, describe, expect, it } from 'bun:test';
import { configureBusinessSdk, createBusinessClient, orvelt } from '../../src/config.ts';

const apiKeySecurity = [{ in: 'header' as const, name: 'x-api-key', type: 'apiKey' as const }];

describe('Business SDK client configuration', () => {
  afterEach(() => {
    orvelt({ apiKey: 'ov_test_reset' });
  });

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

  it('replaces supported shared options without retaining credentials, headers or fetch', () => {
    const previousFetch = (async (_input: URL | RequestInfo) => Response.json({})) as typeof fetch;
    orvelt({
      apiKey: 'old-key',
      baseUrl: 'https://old.example/v1',
      headers: { 'x-api-key': 'old-header-key', 'x-tenant': 'previous' },
      fetch: previousFetch,
      throwOnError: true,
    });
    const configured = orvelt({ apiKey: 'new-key' }).getConfig();
    expect(configured.baseUrl).toBe('https://api.orvelt.com/v1');
    expect(configured.fetch).toBeUndefined();
    expect(configured.throwOnError).toBe(false);
    expect(new Headers(configured.headers as Headers).has('x-tenant')).toBe(false);
    expect(new Headers(configured.headers as Headers).has('x-api-key')).toBe(false);
    expect(typeof configured.auth).toBe('function');
  });

  it('uses apiKey rather than a conflicting client header and keeps clients isolated', async () => {
    const requests: Request[] = [];
    const fetch = (async (request: Request) => {
      requests.push(request);
      return Response.json({});
    }) as typeof globalThis.fetch;
    const first = createBusinessClient({
      apiKey: 'first',
      fetch,
      headers: { 'X-API-KEY': 'stale' },
    });
    const second = createBusinessClient({ apiKey: 'second', fetch });
    orvelt({ apiKey: 'shared' });
    await Promise.all([
      first.get({ url: '/test', security: apiKeySecurity }),
      second.get({ url: '/test', security: apiKeySecurity }),
    ]);
    expect(requests.map((request) => request.headers.get('x-api-key'))).toEqual([
      'first',
      'second',
    ]);
  });

  it('does not partially reconfigure the shared client on invalid input', () => {
    const shared = orvelt({ apiKey: 'existing', headers: { 'x-tenant': 'retained' } });
    expect(() => orvelt({ apiKey: 'invalid', baseUrl: 'ftp://example.com' })).toThrow(TypeError);
    expect(new Headers(shared.getConfig().headers as Headers).get('x-tenant')).toBe('retained');
  });

  for (const baseUrl of [
    '',
    'relative/path',
    '//attacker.example/v1',
    '/\\\\attacker.example',
    'ftp://example.com',
    'https://user:pass@example.com/v1',
    'https://example.com/v1?x=1',
    'https://example.com/v1#fragment',
  ]) {
    it(`rejects unsafe or malformed baseUrl ${JSON.stringify(baseUrl)}`, () => {
      expect(() => createBusinessClient({ apiKey: 'test', baseUrl })).toThrow(TypeError);
    });
  }

  for (const [baseUrl, expected] of [
    [' /v1/// ', '/v1/test'],
    ['/', '/test'],
    [' https://example.test/v1/// ', 'https://example.test/v1/test'],
  ]) {
    it(`normalizes baseUrl ${JSON.stringify(baseUrl)}`, () => {
      expect(createBusinessClient({ apiKey: 'test', baseUrl }).buildUrl({ url: '/test' })).toBe(
        expected,
      );
    });
  }

  it('rejects blank credentials before issuing a request', () => {
    expect(() => createBusinessClient({ apiKey: '   ' })).toThrow(
      'apiKey must be a non-empty string.',
    );
  });
});
