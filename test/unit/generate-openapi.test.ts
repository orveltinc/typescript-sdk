import { describe, expect, it } from 'bun:test';
import { isContractProcedure, type AnyContractRouter } from '@orpc/contract';
import { contract, type BusinessProcedureMeta } from '@pointsy/business-contract';
import { DEFAULT_BUSINESS_API_BASE_URL } from '../../src/constants.ts';
import { generateBusinessOpenApiDocument } from '../../scripts/generate-openapi.ts';

const httpMethods = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

function countApiKeyProcedures(router: AnyContractRouter): number {
  if (isContractProcedure(router)) {
    const meta = router['~orpc'].meta as BusinessProcedureMeta;
    return meta.apiKeyPermission && meta.exposeInRest !== false ? 1 : 0;
  }

  return Object.values(router).reduce((count, child) => count + countApiKeyProcedures(child), 0);
}

describe('public Business OpenAPI document', () => {
  it('contains every API-key procedure and no session-only procedures', async () => {
    const document = await generateBusinessOpenApiDocument();
    const operations = Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => httpMethods.has(method))
        .map(([method, operation]) => ({ method, operation, path })),
    );

    expect(operations).toHaveLength(countApiKeyProcedures(contract));
    expect(operations.length).toBeGreaterThan(0);
    expect(document.paths?.['/project/{projectId}/goals']?.get).toBeDefined();
    expect(document.paths?.['/project/{projectId}/goals']?.get?.operationId).toBe('goals.list');
    expect(document.paths?.['/project/{projectId}/goals']?.post?.operationId).toBe('goals.create');
    expect(document.paths?.['/project/{projectId}/preverified-links']?.get?.operationId).toBe(
      'preverification.list',
    );
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
    expect(document.paths?.['/kb']?.get).toBeDefined();
    expect(document.paths?.['/kb']?.get?.tags).toEqual(['Knowledge Base']);
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
