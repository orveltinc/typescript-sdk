import { register } from 'node:module';

register('./hey-api-typescript-loader.mjs', import.meta.url);
await import(new URL('../node_modules/@hey-api/openapi-ts/dist/run.mjs', import.meta.url).href);
