import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type UserConfig } from '@hey-api/openapi-ts';
import { DEFAULT_BUSINESS_API_BASE_URL } from './src/constants.ts';

const inputPath = fileURLToPath(new URL('./openapi.json', import.meta.url));
const defaultOutputPath = process.env.HEY_API_OUTPUT_PATH
  ? resolve(process.cwd(), process.env.HEY_API_OUTPUT_PATH)
  : fileURLToPath(new URL('./src/generated', import.meta.url));

export function createBusinessSdkGeneratorConfig(outputPath = defaultOutputPath): UserConfig {
  return {
    input: inputPath,
    output: {
      clean: true,
      module: { extension: '.js' },
      path: outputPath,
      postProcess: [
        {
          command: 'bun',
          args: [
            fileURLToPath(new URL('./scripts/fix-generated-headers.ts', import.meta.url)),
            '{{path}}',
          ],
        },
        'oxfmt',
      ],
      tsConfigPath: fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
    },
    plugins: [
      {
        baseUrl: DEFAULT_BUSINESS_API_BASE_URL,
        name: '@hey-api/client-fetch',
      },
      '@hey-api/typescript',
      {
        compatibilityVersion: 4,
        name: 'zod',
      },
      {
        name: '@hey-api/sdk',
        paramsStructure: 'flat',
        validator: { response: 'zod' },
      },
    ],
  };
}

export default defineConfig(createBusinessSdkGeneratorConfig());
