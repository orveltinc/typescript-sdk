import type { AnyContractProcedure } from '@orpc/contract';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import {
  contract,
  type BusinessApiKeyPermission,
  type BusinessProcedureMeta,
} from '@pointsy/business-contract';
import { z } from 'zod';
import { DEFAULT_BUSINESS_API_BASE_URL } from '../src/constants.ts';

const outputUrl = new URL('../openapi.json', import.meta.url);
const packageJsonUrl = new URL('../package.json', import.meta.url);
const httpMethods = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

interface OpenApiOperation {
  operationId?: string;
  security?: Array<Record<string, string[]>>;
  [key: string]: unknown;
}

interface OpenApiDocument {
  components?: {
    securitySchemes?: Record<string, unknown>;
    [key: string]: unknown;
  };
  info: {
    description?: string;
    title: string;
    version: string;
  };
  openapi: string;
  paths?: Record<string, Record<string, OpenApiOperation>>;
  security?: Array<Record<string, string[]>>;
  servers?: Array<{ url: string }>;
  [key: string]: unknown;
}

function getProcedureMeta(procedure: AnyContractProcedure) {
  return procedure['~orpc'].meta as BusinessProcedureMeta;
}

function getApiKeyPermission(procedure: AnyContractProcedure) {
  return getProcedureMeta(procedure).apiKeyPermission;
}

function isPublicRestProcedure(procedure: AnyContractProcedure) {
  const meta = getProcedureMeta(procedure);
  return meta.exposeInRest !== false && Boolean(meta.apiKeyPermission);
}

function operationKey(procedure: AnyContractProcedure, contractPath: readonly string[]): string {
  const route = procedure['~orpc'].route;
  const method = String(route.method ?? 'POST').toLowerCase();
  const path = route.path ?? `/${contractPath.join('/')}`;
  return `${method} ${path}`;
}

/**
 * Project scope is already represented by the required `projectId` path field.
 * Keep it out of operation IDs so generated SDK functions stay concise.
 */
function shortenOperationId(operationId: string): string {
  return operationId.startsWith('project.') ? operationId.slice('project.'.length) : operationId;
}

export async function generateBusinessOpenApiDocument(): Promise<OpenApiDocument> {
  const packageJson = (await Bun.file(packageJsonUrl).json()) as { version: string };
  const permissions = new Map<string, BusinessApiKeyPermission>();
  const generator = new OpenAPIGenerator({
    schemaConverters: [
      {
        condition: (schema: unknown) => schema instanceof z.ZodVoid,
        convert: (): [boolean, Record<string, never>] => [false, {}],
      },
      new ZodToJsonSchemaConverter(),
    ],
  });

  const document = (await generator.generate(contract, {
    info: {
      title: 'Orvelt Business API',
      version: packageJson.version,
      description:
        'Public REST API for external Orvelt Business integrations. Every operation requires a project-scoped API key in the x-api-key header.',
    },
    servers: [{ url: DEFAULT_BUSINESS_API_BASE_URL }],
    components: {
      securitySchemes: {
        businessApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description:
            'Project-scoped Orvelt Business API key. Create keys in Orvelt Business and keep them server-side.',
        },
      },
    },
    security: [{ businessApiKey: [] }],
    filter: ({ contract: procedure, path }) => {
      if (!isPublicRestProcedure(procedure)) return false;

      const permission = getApiKeyPermission(procedure);
      if (!permission) return false;

      permissions.set(operationKey(procedure, path), permission);
      return true;
    },
  })) as OpenApiDocument;

  document.security = [{ businessApiKey: [] }];
  const operationIds = new Set<string>();

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method)) continue;

      if (!operation.operationId) {
        throw new Error(`Missing operation ID for ${method.toUpperCase()} ${path}`);
      }

      const operationId = shortenOperationId(operation.operationId);
      if (operationIds.has(operationId)) {
        throw new Error(`Duplicate operation ID after shortening: ${operationId}`);
      }
      operationIds.add(operationId);
      operation.operationId = operationId;

      const permission = permissions.get(`${method} ${path}`);
      if (!permission) {
        throw new Error(`Missing API-key permission metadata for ${method.toUpperCase()} ${path}`);
      }

      operation.security = [{ businessApiKey: [] }];
      operation['x-api-key-permission'] = permission;
    }
  }

  return document;
}

export function serializeOpenApiDocument(document: OpenApiDocument) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export async function writeBusinessOpenApiDocument() {
  const document = await generateBusinessOpenApiDocument();
  await Bun.write(outputUrl, serializeOpenApiDocument(document));

  const operationCount = Object.values(document.paths ?? {}).reduce(
    (count, pathItem) =>
      count + Object.keys(pathItem).filter((method) => httpMethods.has(method)).length,
    0,
  );
  console.log(`Generated openapi.json with ${operationCount} public API-key operations.`);
}

if (import.meta.main) {
  await writeBusinessOpenApiDocument();
}
