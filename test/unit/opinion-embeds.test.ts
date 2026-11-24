import { describe, expect, it } from 'bun:test';
import { opinionEmbedUrl } from '../../src/browser';
import { zOpinionEmbedConfiguration } from '../../src/generated/zod.gen';
import { Orvelt } from '../../src/index';
const projectId = '01920000-0000-7000-8000-000000000001';
describe('frontend-only opinion installation', () => {
  it('uses a reusable public project URL, not a Business API session operation', () => {
    expect(opinionEmbedUrl({ projectId })).toBe(
      `https://orvelt.com/embed/opinion/${projectId}?visibility=public`,
    );
    expect(new Orvelt('ov_test_key')).not.toHaveProperty('opinionEmbeds');
  });
  it('encodes an optional reference as metadata with private visibility', () => {
    const url = new URL(
      opinionEmbedUrl({ projectId, visibility: 'private', externalUserId: ' order/42 & café ' }),
    );
    expect(url.searchParams.get('externalUserId')).toBe('order/42 & café');
    expect(url.searchParams.get('visibility')).toBe('private');
    expect(url.hash).toBe('');
  });
  it('validates references without treating them as authenticated accounts', () => {
    for (const externalUserId of ['', '   ', 'x'.repeat(257), 'bad\u0000id'])
      expect(() => opinionEmbedUrl({ projectId, externalUserId })).toThrow();
    expect(() => opinionEmbedUrl({ projectId: 'invalid' })).toThrow();
  });
  it('rejects visibility values other than public or private at runtime', () => {
    for (const visibility of ['choice', 'both', '', null, true]) {
      // @ts-expect-error Invalid JavaScript configuration must also fail at runtime.
      expect(() => opinionEmbedUrl({ projectId, visibility })).toThrow();
    }
  });
});

// The browser embed validates by hand to stay small; these cases must keep it in step with the API
// contract, so a regenerated contract that disagrees with an expectation fails here.
describe('opinion embed configuration matches the API contract', () => {
  const cases: [string, Record<string, unknown>, boolean][] = [
    ['an uppercase UUID', { projectId: projectId.toUpperCase() }, true],
    ['the nil UUID', { projectId: '00000000-0000-0000-0000-000000000000' }, true],
    ['a UUID with version 9', { projectId: '01920000-0000-9000-8000-000000000001' }, false],
    [
      'a UUID with an invalid variant',
      { projectId: '01920000-0000-7000-c000-000000000001' },
      false,
    ],
    ['a numeric project ID', { projectId: 42 }, false],
    ['private visibility', { visibility: 'private' }, true],
    ['a 256-character reference', { externalUserId: 'x'.repeat(256) }, true],
    ['a 257-character reference', { externalUserId: 'x'.repeat(257) }, false],
    ['a reference containing a tab', { externalUserId: 'a\tb' }, false],
    ['a reference containing DEL', { externalUserId: 'a\u007fb' }, false],
    ['a numeric reference', { externalUserId: 42 }, false],
    ['nested JSON attributes', { attributes: { a: [1, 'b', null, { c: false }] } }, true],
    [
      'null-prototype attributes',
      { attributes: Object.assign(Object.create(null), { a: 1 }) },
      true,
    ],
    ['NaN attributes', { attributes: { a: Number.NaN } }, false],
    ['infinite attributes', { attributes: [Infinity] }, false],
    ['undefined attribute values', { attributes: { a: undefined } }, false],
    ['sparse attribute arrays', { attributes: Object.assign([], { 1: 'b' }) }, false],
    ['Date attributes', { attributes: { at: new Date(0) } }, false],
    ['Map attributes', { attributes: new Map() }, false],
  ];
  for (const [name, overrides, accepted] of cases)
    it(`${accepted ? 'accepts' : 'rejects'} ${name}`, () => {
      const configuration = { projectId, visibility: 'public', ...overrides };
      expect(zOpinionEmbedConfiguration.safeParse(configuration).success).toBe(accepted);
      const build = () => opinionEmbedUrl(configuration as never);
      if (accepted) expect(build).not.toThrow();
      else expect(build).toThrow();
    });
});
