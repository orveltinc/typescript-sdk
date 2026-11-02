import { describe, expect, it } from 'bun:test';
import { opinionEmbedUrl } from '../../src/browser';
import { useProject } from '../../src/index';
const projectId = '01920000-0000-7000-8000-000000000001';
describe('frontend-only opinion installation', () => {
  it('uses a reusable public project URL, not a Business API session operation', () => {
    expect(opinionEmbedUrl({ projectId })).toBe(
      `https://orvelt.com/embed/opinion/${projectId}?visibility=public`,
    );
    expect(useProject(projectId)).not.toHaveProperty('opinionEmbeds');
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
