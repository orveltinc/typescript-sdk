import { register } from 'node:module';

if (process.versions.bun) {
  throw new Error(
    'Hey API generation requires Node.js 24; Bun does not run the TypeScript loader hooks.',
  );
}

register('./hey-api-typescript-loader.mjs', import.meta.url);
await import(new URL('../node_modules/@hey-api/openapi-ts/dist/run.mjs', import.meta.url).href);
