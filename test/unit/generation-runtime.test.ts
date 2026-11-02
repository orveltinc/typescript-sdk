import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const hasApplicationImages = existsSync(
  new URL('../../../../apps/business/Dockerfile', import.meta.url),
);

describe('SDK generation runtime', () => {
  it('rejects Bun before importing the generator without its TypeScript compatibility loader', () => {
    const result = Bun.spawnSync({
      cmd: [process.execPath, 'scripts/hey-api-runner.mjs'],
      cwd: new URL('../../', import.meta.url).pathname,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).not.toBe(0);
    expect(new TextDecoder().decode(result.stderr)).toContain('requires Node.js 24');
    expect(new TextDecoder().decode(result.stderr)).not.toContain('SyntaxKind');
  });

  it.skipIf(!hasApplicationImages)(
    'provides real Node in both application images that build the SDK',
    async () => {
      for (const app of ['business', 'storefront']) {
        const dockerfile = await readFile(
          new URL(`../../../../apps/${app}/Dockerfile`, import.meta.url),
          'utf8',
        );
        expect(dockerfile).toContain(
          'COPY --from=node:24-slim /usr/local/bin/node /usr/local/bin/node',
        );
      }
    },
  );
});
