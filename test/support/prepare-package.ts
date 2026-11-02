import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const sdkDirectory = fileURLToPath(new URL('../../', import.meta.url));
export const archive = join(sdkDirectory, 'test/results/orvelt-business.tgz');
export const consumerDirectory = join(sdkDirectory, 'test/results/consumer');
export const installedPackage = join(consumerDirectory, 'node_modules/@orvelt/business');
export const browserBundle = join(installedPackage, 'dist/opinion-embed.js');

export default async function preparePackage() {
  if (!existsSync(archive)) {
    throw new Error(
      'Pack the SDK into test/results/orvelt-business.tgz before running browser checks.',
    );
  }
  await mkdir(consumerDirectory, { recursive: true });
  await writeFile(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  // Install the actual tarball, not a workspace symlink or source entry. Lifecycle scripts stay off.
  await run(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--workspaces=false', archive],
    { cwd: consumerDirectory, timeout: 120_000 },
  );
}
