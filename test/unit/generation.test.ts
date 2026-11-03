import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareDirectories } from '../../scripts/check-generated.ts';
import {
  fixGeneratedClientHeaders,
  fixGeneratedHeaders,
} from '../../scripts/fix-generated-headers.ts';
import * as generated from '../../src/generated/index.ts';
import * as api from '../../src/api.ts';
import spec from '../../openapi.json';

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const exportedOperations: Record<string, unknown> = generated;

describe('SDK generation invariants', () => {
  it('exposes every spec operation exactly once in the generated SDK and facade', () => {
    const operations = Object.values(spec.paths).flatMap((item) =>
      Object.entries(item)
        .filter(([method]) => methods.has(method))
        .map(([, operation]) => operation.operationId),
    );
    const names = operations.map((id) =>
      id.replace(/\.([a-z])/g, (_match: string, letter: string) => letter.toUpperCase()),
    );
    expect(Object.keys(generated).toSorted()).toEqual(names.toSorted());
    for (const id of operations) {
      // Nested groups such as questions.versions.create resolve segment by segment.
      const resolved = (id as string)
        .split('.')
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], api.project);
      const name = id.replace(/\.([a-z])/g, (_match: string, letter: string) =>
        letter.toUpperCase(),
      );
      expect(resolved).toBe(exportedOperations[name]);
    }
  });

  it('applies the pinned header workaround and fails closed on unexpected output', () => {
    const input = `import { buildClientParams, type Client } from './client/index.js';
      headers: { 'Content-Type': 'application/json', ...options?.headers, ...params.headers },`;
    const output = fixGeneratedHeaders(input);
    expect(output).toContain('Object.fromEntries(new Headers(options.headers))');
    expect(output).toContain(': options?.headers)');
    expect(output).not.toContain('...options?.headers');
    expect(
      fixGeneratedClientHeaders(
        'header instanceof Headers ? headersEntries(header) : Object.entries(header)',
      ),
    ).toContain('Array.isArray(header) ? headersEntries(new Headers(header))');
    expect(() => fixGeneratedClientHeaders('changed generator output')).toThrow(
      'unrecognized header iteration',
    );
    expect(() => fixGeneratedHeaders('changed generator output')).toThrow('output has changed');
    expect(() => fixGeneratedHeaders(`${input}\n...options?.headers`)).toThrow(
      'unrecognized header construction',
    );
  });

  it('reports missing, stale and changed committed files in the correct direction', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'business-sdk-diff-'));
    try {
      const expected = join(directory, 'expected');
      const actual = join(directory, 'actual');
      await Promise.all([mkdir(expected), mkdir(actual)]);
      await Promise.all([
        writeFile(join(expected, 'missing.ts'), 'new file'),
        writeFile(join(actual, 'stale.ts'), 'removed file'),
        writeFile(join(expected, 'changed.ts'), 'new content'),
        writeFile(join(actual, 'changed.ts'), 'old content'),
        writeFile(join(expected, 'same.ts'), 'same'),
        writeFile(join(actual, 'same.ts'), 'same'),
      ]);
      expect((await compareDirectories(expected, actual)).toSorted()).toEqual([
        'changed generated file: changed.ts',
        'missing generated file: missing.ts',
        'stale generated file: stale.ts',
      ]);
      expect(await compareDirectories(expected, expected)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
