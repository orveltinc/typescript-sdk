import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = new URL('../', import.meta.url);
const generatedDirectory = new URL('../src/generated/', import.meta.url);
const hasMonorepoContracts = existsSync(
  new URL('../../business-contract/src/index.ts', import.meta.url),
);

async function listFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
    }),
  );
  return files.flat().toSorted();
}

export async function compareDirectories(expectedDirectory: string, actualDirectory: string) {
  const [expectedFiles, actualFiles] = await Promise.all([
    listFiles(expectedDirectory),
    listFiles(actualDirectory),
  ]);
  const differences = new Set<string>();

  for (const file of expectedFiles) {
    if (!actualFiles.includes(file)) differences.add(`missing generated file: ${file}`);
  }
  for (const file of actualFiles) {
    if (!expectedFiles.includes(file)) differences.add(`stale generated file: ${file}`);
  }

  for (const file of expectedFiles.filter((candidate) => actualFiles.includes(candidate))) {
    const [expected, actual] = await Promise.all([
      readFile(join(expectedDirectory, file)),
      readFile(join(actualDirectory, file)),
    ]);
    if (!expected.equals(actual)) differences.add(`changed generated file: ${file}`);
  }

  return [...differences];
}

async function checkGeneratedArtifacts() {
  const differences: string[] = [];
  // The standalone SDK repository regenerates from its committed OpenAPI document.
  // In the monorepo, also check that document against the live public contracts.
  if (hasMonorepoContracts) {
    const { generateBusinessOpenApiDocument, serializeOpenApiDocument } =
      // Keep this import opaque to tsc: standalone SDK checkouts have no monorepo contracts.
      await import(new URL('./generate-openapi.ts', import.meta.url).href);
    const expected = serializeOpenApiDocument(await generateBusinessOpenApiDocument());
    const actual = await readFile(new URL('../openapi.json', import.meta.url), 'utf8');
    if (actual !== expected)
      differences.push('openapi.json differs from the current public contracts');
  }
  const temporaryDirectory = await mkdtemp(join(fileURLToPath(packageRoot), 'generated-check-'));
  try {
    const result = Bun.spawnSync({
      cmd: ['node', './scripts/hey-api-runner.mjs', '--file', 'openapi-ts.config.ts'],
      cwd: fileURLToPath(packageRoot),
      env: {
        ...process.env,
        HEY_API_OUTPUT_PATH: temporaryDirectory,
        PATH: `${fileURLToPath(new URL('../node_modules/.bin', import.meta.url))}${delimiter}${process.env.PATH ?? ''}`,
      },
      stderr: 'pipe',
      stdout: 'pipe',
    });
    if (!result.success) {
      throw new Error(`Hey API generation failed:\n${new TextDecoder().decode(result.stderr)}`);
    }

    differences.push(
      ...(await compareDirectories(temporaryDirectory, fileURLToPath(generatedDirectory))),
    );
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }

  if (differences.length) {
    throw new Error(
      `Business SDK artifacts are stale:\n- ${differences.join('\n- ')}\nRun "${hasMonorepoContracts ? 'moon run business-sdk:generate' : `bun run --cwd ${fileURLToPath(packageRoot)} generate`}".`,
    );
  }

  console.log('The committed Business SDK is current with openapi.json.');
}

if (import.meta.main) {
  await checkGeneratedArtifacts();
}
