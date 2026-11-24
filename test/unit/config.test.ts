import { describe, expect, it } from 'bun:test';
import { createOrveltClient } from '../../src/config.ts';
import { Orvelt } from '../../src/index.ts';

const apiKeySecurity = [{ in: 'header' as const, name: 'x-api-key', type: 'apiKey' as const }];

describe('Business SDK client configuration', () => {
  it('applies the v1 base URL and x-api-key authentication', async () => {
    let capturedRequest: Request | undefined;
    const client = createOrveltClient({
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

  it('uses apiKey rather than a conflicting client header and keeps clients isolated', async () => {
    const requests: Request[] = [];
    const fetch = (async (request: Request) => {
      requests.push(request);
      return Response.json({});
    }) as typeof globalThis.fetch;
    const first = createOrveltClient({
      apiKey: 'first',
      fetch,
      headers: { 'X-API-KEY': 'stale' },
    });
    const second = createOrveltClient({ apiKey: 'second', fetch });
    await Promise.all([
      first.get({ url: '/test', security: apiKeySecurity }),
      second.get({ url: '/test', security: apiKeySecurity }),
    ]);
    expect(requests.map((request) => request.headers.get('x-api-key'))).toEqual([
      'first',
      'second',
    ]);
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
      expect(() => createOrveltClient({ apiKey: 'test', baseUrl })).toThrow(TypeError);
    });
  }

  for (const [baseUrl, expected] of [
    [' /v1/// ', '/v1/test'],
    ['/', '/test'],
    [' https://example.test/v1/// ', 'https://example.test/v1/test'],
  ]) {
    it(`normalizes baseUrl ${JSON.stringify(baseUrl)}`, () => {
      expect(createOrveltClient({ apiKey: 'test', baseUrl }).buildUrl({ url: '/test' })).toBe(
        expected,
      );
    });
  }

  it('rejects blank credentials before issuing a request', () => {
    expect(() => createOrveltClient({ apiKey: '   ' })).toThrow(
      'apiKey must be a non-empty string.',
    );
    expect(() => new Orvelt('')).toThrow('apiKey must be a non-empty string.');
  });

  it('takes the API key alone and authenticates with it against the default API', async () => {
    const requests: Request[] = [];
    const fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return Response.json({ total: 0, delta: 0 });
    }) as typeof globalThis.fetch;
    await new Orvelt(' ov_test_string ').subscribers.count({ projectId: 'test' }, { fetch });

    expect(requests.map((request) => [request.url, request.headers.get('x-api-key')])).toEqual([
      ['https://api.orvelt.com/v1/project/test/subscribers/count', 'ov_test_string'],
    ]);
  });
});
