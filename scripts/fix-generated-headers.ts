import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @hey-api/openapi-ts@0.99.0 spreads RequestInit headers into a plain object for body
 * operations. Headers instances and tuple arrays are valid inputs, but object spread
 * silently drops/corrupts them. Normalize native header inputs before spreading,
 * preserving record null values (which delete client headers). Also teach the
 * client's mergeHeaders helper to iterate tuple arrays rather than numeric keys.
 * Keep this pinned workaround in generation, never in hand-edited generated files.
 */
export function fixGeneratedHeaders(source: string): string {
  const unsafeSpreads = source.match(/\.\.\.options\?\.headers/g)?.length ?? 0;
  if (!unsafeSpreads) throw new Error('Review the Hey API headers workaround: output has changed.');

  let replacements = 0;
  const result = source.replace(
    /headers:\s*\{\s*(['"])Content-Type\1:\s*(['"])([^'"]+)\2,\s*\.\.\.options\?\.headers,\s*\.\.\.params\.headers,?\s*\}/g,
    (match) => {
      replacements++;
      return match.replace(
        '...options?.headers',
        '...(options?.headers instanceof Headers || Array.isArray(options?.headers) ? Object.fromEntries(new Headers(options.headers)) : options?.headers)',
      );
    },
  );
  if (replacements !== unsafeSpreads)
    throw new Error('Review the Hey API headers workaround: unrecognized header construction.');
  return result;
}

export function fixGeneratedClientHeaders(source: string): string {
  const pattern =
    /header instanceof Headers \? headersEntries\(header\) : Object\.entries\(header\)/g;
  if (source.match(pattern)?.length !== 1)
    throw new Error('Review the Hey API headers workaround: unrecognized header iteration.');
  return source.replace(
    pattern,
    'header instanceof Headers ? headersEntries(header) : Array.isArray(header) ? headersEntries(new Headers(header)) : Object.entries(header)',
  );
}

if (import.meta.main) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Pass the generated output directory.');
  const sdkPath = join(directory, 'sdk.gen.ts');
  const clientPath = join(directory, 'client/utils.gen.ts');
  // Validate both pinned templates before writing either artifact.
  const sdk = fixGeneratedHeaders(await readFile(sdkPath, 'utf8'));
  const client = fixGeneratedClientHeaders(await readFile(clientPath, 'utf8'));
  await Promise.all([writeFile(sdkPath, sdk), writeFile(clientPath, client)]);
}
