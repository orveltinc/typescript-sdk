import { fileURLToPath } from 'node:url';

/** Standalone browser bundle distributed in the npm package and served by package CDNs. */
export async function buildOpinionEmbedScript() {
  const result = await Bun.build({
    entrypoints: [fileURLToPath(new URL('../src/browser-script.ts', import.meta.url))],
    target: 'browser',
    format: 'iife',
    minify: true,
  });
  if (!result.success)
    throw new AggregateError(result.logs, 'The opinion embed script did not build.');
  const output = result.outputs[0];
  if (!output) throw new Error('The opinion embed build produced no script.');
  return output.text();
}

if (import.meta.main) {
  const source = await buildOpinionEmbedScript();
  await Bun.write(new URL('../dist/opinion-embed.js', import.meta.url), source);
}
