import { describe, expect, it } from 'bun:test';
import { readFile, readdir, stat } from 'node:fs/promises';
import metadata from '../../package.json';

const packageRoot = new URL('../../', import.meta.url);
const skillNames = ['orvelt-business-sdk', 'orvelt-opinion-embeds'];

describe('bundled agent skills', () => {
  it('includes skills in the npm allowlist and exposes their Markdown subpaths', () => {
    expect(metadata.files).toContain('skills');
    expect(metadata.exports['./skills/*']).toBe('./skills/*');
  });

  it('provides discoverable skills with valid local references', async () => {
    const skillsRoot = new URL('skills/', packageRoot);
    expect((await readdir(skillsRoot)).toSorted()).toEqual(skillNames);

    for (const name of skillNames) {
      const skillUrl = new URL(`${name}/SKILL.md`, skillsRoot);
      const content = await readFile(skillUrl, 'utf8');
      const frontmatter = content.match(/^---\nname: ([^\n]+)\ndescription: ([^\n]+)\n---\n/);
      expect(frontmatter).not.toBeNull();
      expect(frontmatter?.[1]).toBe(name);
      expect(name).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(frontmatter?.[2].length).toBeGreaterThan(0);
      expect(frontmatter?.[2].length).toBeLessThanOrEqual(1024);
      expect(content.split('\n').length).toBeLessThan(500);
      expect(content).toContain('# Orvelt');

      const links = [...content.matchAll(/\]\(([^)]+)\)/g)];
      expect(links.length).toBeGreaterThan(0);
      for (const [, target] of links) {
        if (!target) throw new Error('A skill reference must have a target.');
        expect((await stat(new URL(target, skillUrl))).isFile()).toBe(true);
      }
    }
  });

  it('documents each bundled skill and explains agent registration', async () => {
    const readme = await readFile(new URL('README.md', packageRoot), 'utf8');
    for (const name of skillNames) {
      expect(readme).toContain(`(skills/${name}/SKILL.md)`);
    }
    expect(readme).toContain('cp -R node_modules/@orvelt/business/skills/. .agents/skills/');
    expect(readme).toContain('Installing the npm package alone does not register skills');
  });
});
