import { describe, expect, it } from 'bun:test';
import { ProcedureContract, type AnyContractRouter } from '@orpc/contract';
import { existsSync } from 'node:fs';
import { DEFAULT_BUSINESS_API_BASE_URL } from '../../src/constants.ts';
import type { generateBusinessOpenApiDocument as GenerateDocument } from '../../scripts/generate-openapi.ts';

const contractUrl = new URL('../../../business-contract/src/index.ts', import.meta.url);
const hasMonorepoContracts = existsSync(contractUrl);

// This suite runs in the monorepo; standalone CI validates the committed spec/client instead.
async function generateBusinessOpenApiDocument(): ReturnType<typeof GenerateDocument> {
  const generator = await import(
    new URL('../../scripts/generate-openapi.ts', import.meta.url).href
  );
  return generator.generateBusinessOpenApiDocument();
}

const httpMethods = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

function countApiKeyProcedures(
  router: AnyContractRouter,
  getMeta: (typeof import('@pointsy/business-contract'))['getBusinessProcedureMeta'],
): number {
  if (router instanceof ProcedureContract) {
    const meta = getMeta(router);
    return meta.exposeInSdk === true ? 1 : 0;
  }

  return Object.values(router).reduce(
    (count, child) => count + countApiKeyProcedures(child, getMeta),
    0,
  );
}

describe.skipIf(!hasMonorepoContracts)('public Business OpenAPI document', () => {
  it('contains only the explicitly selected SDK procedures', async () => {
    const document = await generateBusinessOpenApiDocument();
    const operations = Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => httpMethods.has(method))
        .map(([method, operation]) => ({ method, operation, path })),
    );

    const { contract, getBusinessProcedureMeta } = await import(contractUrl.href);
    expect(operations).toHaveLength(countApiKeyProcedures(contract, getBusinessProcedureMeta));
    expect(operations).toHaveLength(12);
    expect(operations.map(({ operation }) => operation.operationId).toSorted()).toEqual([
      'answers.list',
      'link.create',
      'link.list',
      'link.resend',
      'opinions.list',
      'qr.display',
      'questions.create',
      'questions.delete',
      'questions.list',
      'questions.update',
      'subscribers.count',
      'subscribers.invite',
    ]);
    for (const path of [
      '/project/{projectId}/goals',
      '/project/{projectId}/goals/{goalId}',
      '/project/{projectId}/tags',
      '/project/{projectId}/subscribers/{id}',
      '/kb',
      '/kb/{id}',
      '/project/{projectId}',
      '/project/{projectId}/assets',
      '/billing/entitlements',
      '/oauth-connections',
      '/oauth-connections/revoke',
      '/storefront/details',
      '/storefront/details/logo',
      '/storefront/location',
      '/storefront/categories',
      '/profiles/avatar',
    ]) {
      expect(document.paths?.[path], path).toBeUndefined();
    }
    expect(document.paths?.['/project/{projectId}/opinions']?.get?.operationId).toBe(
      'opinions.list',
    );
    expect(document.paths?.['/project/{projectId}/link']?.get?.operationId).toBe('link.list');
    expect(document.paths?.['/project/{projectId}/qr']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/qr/display']?.post?.operationId).toBe(
      'qr.display',
    );
    expect(document.paths?.['/project/{projectId}/subscribers']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/opinions/{id}/responses']).toBeUndefined();
    expect(document.paths?.['/webhooks/portal']).toBeUndefined();
    expect(document.paths?.['/webhooks/destinations']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/qr/{qrCodeId}/display']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/qr/{qrCodeId}/regenerate']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/qr/{qrCodeId}/revoke']).toBeUndefined();
    expect(
      operations.every(({ operation }) => !operation.operationId?.startsWith('project.')),
    ).toBe(true);
    expect(document.paths?.['/project/{projectId}/analytics']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/receipts']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/receipts/{id}']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/reviews']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/opinions/sync']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/answers/sync']).toBeUndefined();
    expect(document.paths?.['/organization/knowledgebase']).toBeUndefined();
    expect(document.paths?.['/kb']).toBeUndefined();
    expect(document.paths?.['/projects']).toBeUndefined();
    expect(document.paths?.['/organization/settings']).toBeUndefined();
    expect(document.paths?.['/profiles']).toBeUndefined();

    for (const { operation } of operations) {
      expect(operation.security).toEqual([{ businessApiKey: [] }]);
      expect(operation['x-api-key-permission']).toMatchObject({
        action: expect.any(String),
        resource: expect.any(String),
      });
    }
  });

  it('uses one link creation operation with email enabled by default', async () => {
    const document = await generateBusinessOpenApiDocument();
    expect(document.paths?.['/project/{projectId}/link/email']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/link']?.post).toMatchObject({
      operationId: 'link.create',
      requestBody: {
        content: {
          'application/json': {
            schema: { properties: { sendEmail: { type: 'boolean', default: true } } },
          },
        },
      },
    });
  });

  it('keeps collections resource-owned and session-only CSV exports out of the SDK', async () => {
    const document = await generateBusinessOpenApiDocument();
    for (const resource of ['answers', 'opinions'] as const) {
      const operation = document.paths?.[`/project/{projectId}/${resource}`]?.get;
      const parameters = operation?.parameters as Array<{ name: string }>;
      const names = parameters.map(({ name }) => name);
      expect(names).not.toContain('resource');
      expect(names).not.toContain('format');
      expect(names).toContain(resource === 'answers' ? 'responseId' : 'opinionId');
      expect(names).not.toContain(resource === 'answers' ? 'opinionId' : 'responseId');
      expect(document.paths?.[`/project/{projectId}/${resource}/export`]).toBeUndefined();
    }
    expect(document.paths?.['/project/{projectId}/responses']).toBeUndefined();
    expect(document.paths?.['/project/{projectId}/responses/export']).toBeUndefined();
  });

  it('keeps the committed OpenAPI document aligned with the live public contracts', async () => {
    const committed = await Bun.file(new URL('../../openapi.json', import.meta.url)).json();
    expect(committed).toEqual(await generateBusinessOpenApiDocument());
  });

  it('preserves UUID formats, integer pagination bounds, and datetime formats', async () => {
    const document = await generateBusinessOpenApiDocument();
    expect(document.paths?.['/project/{projectId}/opinions']?.get).toMatchObject({
      parameters: expect.arrayContaining([
        expect.objectContaining({
          name: 'projectId',
          schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
        }),
        expect.objectContaining({
          name: 'page',
          schema: expect.objectContaining({
            type: 'integer',
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
            default: 1,
          }),
        }),
        expect.objectContaining({
          name: 'limit',
          schema: expect.objectContaining({
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
          }),
        }),
      ]),
      responses: {
        200: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  opinions: {
                    items: {
                      properties: {
                        projectId: { type: 'string', format: 'uuid' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it('publishes resolvable recursive JSON references for embed attributes', async () => {
    const document = await generateBusinessOpenApiDocument();
    expect(document.components?.schemas?.OpinionEmbedConfiguration).toMatchObject({
      properties: { attributes: expect.any(Object) },
    });
    const references: string[] = [];
    JSON.stringify(document, (key, value) => {
      if (key === '$ref' && typeof value === 'string') references.push(value);
      return value;
    });
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.startsWith('#/components/schemas/')).toBe(true);
      const name = reference.slice('#/components/schemas/'.length);
      expect(document.components?.schemas?.[name]).toBeDefined();
    }
  });

  it('publishes only x-api-key authentication and an absolute production server', async () => {
    const document = await generateBusinessOpenApiDocument();

    expect(document.servers).toEqual([{ url: DEFAULT_BUSINESS_API_BASE_URL }]);
    expect(document.security).toEqual([{ businessApiKey: [] }]);
    expect(Object.keys(document.components?.securitySchemes ?? {})).toEqual(['businessApiKey']);
    expect(document.components?.securitySchemes?.businessApiKey).toMatchObject({
      in: 'header',
      name: 'x-api-key',
      type: 'apiKey',
    });
  });
});
