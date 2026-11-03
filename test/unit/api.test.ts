import { describe, expect, it } from 'bun:test';
import {
  answers,
  opinions,
  link,
  project,
  qr,
  questions,
  subscribers,
  useProject,
} from '../../src/index.ts';
import * as sdk from '../../src/index.ts';
import { createBusinessClient } from '../../src/config.ts';

const projectId = '00000000-0000-0000-0000-000000000000';

function expectFunctions(value: Record<string, unknown>, keys: string[]) {
  expect(Object.keys(value)).toEqual(keys);
  for (const key of keys) {
    expect(value[key]).toEqual(expect.any(Function));
  }
}

describe('grouped Business SDK API', () => {
  it('exports the keyless embed helpers and full configuration from the base SDK', async () => {
    const browser = await import('../../src/browser.ts');
    expect(sdk.orveltEmbed).toBe(browser.orveltEmbed);
    expect(sdk.createOpinionEmbed).toBe(browser.createOpinionEmbed);
    expect(sdk.opinionEmbedUrl).toBe(browser.opinionEmbedUrl);
    expect(sdk.attachOpinionEmbed).toBe(browser.attachOpinionEmbed);
    const configuration: sdk.OpinionEmbedConfiguration = {
      projectId: '01920000-0000-7000-8000-000000000001',
      origin: 'http://localhost:3000',
      onSubmitted: () => {},
      onSessionCreated: () => {},
    };
    expect(sdk.orveltEmbed.configure(configuration).mount).toEqual(expect.any(Function));
    expect(sdk.opinionEmbedUrl(configuration)).toBe(
      'http://localhost:3000/embed/opinion/01920000-0000-7000-8000-000000000001?visibility=public',
    );
  });
  it('does not export retired REST operations', () => {
    for (const name of [
      'goals',
      'tags',
      'knowledgeBase',
      'goalsList',
      'tagsGet',
      'kbGet',
      'subscribersBlock',
      'subscribersList',
      'opinionsRespond',
      'qrList',
      'qrCreate',
      'qrDisplayRotating',
      'webhooks',
      'webhooksPortal',
      'webhooksUpsertDestination',
      'preverificationCreateLink',
      'preverifiedLinks',
      'preverifiedLinksCreate',
      'preverifiedLinksList',
      'preverifiedLinksResend',
      'qrCodes',
      'qrCodesDisplay',
    ]) {
      expect(sdk).not.toHaveProperty(name);
    }
    for (const name of ['preverifiedLinks', 'qrCodes', 'preverification']) {
      expect(useProject(projectId)).not.toHaveProperty(name);
      expect(project).not.toHaveProperty(name);
    }
    expect(useProject(projectId)).not.toHaveProperty('goals');
    expect(useProject(projectId)).not.toHaveProperty('tags');
    expect(subscribers).not.toHaveProperty('block');
  });

  it('exposes every operation under its resource', () => {
    const { versions, ...questionOperations } = questions;
    expectFunctions(questionOperations, ['list', 'create', 'update', 'delete']);
    expectFunctions(versions, ['create']);
    expectFunctions(link, ['list', 'create', 'resend']);
    expectFunctions(qr, ['display']);
    expectFunctions(opinions, ['list']);
    expectFunctions(answers, ['list']);
    expectFunctions(subscribers, ['count', 'invite']);
  });

  it('keeps project groups as a compatibility alias', () => {
    expect(project.questions).toBe(questions);
    expect(project.link).toBe(link);
    expect(project.qr).toBe(qr);
    expect(project.opinions).toBe(opinions);
    expect(project.answers).toBe(answers);
    expect(project.subscribers).toBe(subscribers);
  });

  it('creates a project-scoped facade without project parameters', () => {
    const scopedProject = useProject(projectId);

    const { versions, ...questionOperations } = scopedProject.questions;
    expectFunctions(questionOperations, ['list', 'create', 'update', 'delete']);
    expectFunctions(versions, ['create']);
    expectFunctions(scopedProject.link, ['list', 'create', 'resend']);
    expectFunctions(scopedProject.qr, ['display']);
    expectFunctions(scopedProject.opinions, ['list']);
    expectFunctions(scopedProject.answers, ['list']);
    expectFunctions(scopedProject.subscribers, ['count', 'invite']);
  });

  it('passes flattened project parameters to the generated operation', async () => {
    let capturedRequest: Request | undefined;
    const client = createBusinessClient({
      apiKey: 'ov_test_key',
      baseUrl: 'https://example.test/v1',
      fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
        capturedRequest = new Request(input, init);
        return Response.json({
          opinions: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
      }) as typeof fetch,
    });

    const result = await opinions.list({ projectId, page: 1, limit: 10 }, { client });

    expect(result.data?.opinions).toEqual([]);
    expect(capturedRequest?.method).toBe('GET');
    expect(capturedRequest?.url).toBe(
      `https://example.test/v1/project/${projectId}/opinions?page=1&limit=10`,
    );
  });

  it('injects the project ID into scoped operations', async () => {
    let capturedRequest: Request | undefined;
    const client = createBusinessClient({
      apiKey: 'ov_test_key',
      baseUrl: 'https://example.test/v1',
      fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
        capturedRequest = new Request(input, init);
        return Response.json({
          invited: [{ name: 'Alex', email: 'alex@example.com' }],
          skipped: [],
          invitationAllowance: {
            used: 1,
            limit: 100,
            remaining: 99,
            resetsAt: '2026-10-16T00:00:00.000Z',
          },
        });
      }) as typeof fetch,
    });

    const scopedProject = useProject(projectId);
    const result = await scopedProject.subscribers.invite(
      { subscribers: [{ name: 'Alex', email: 'alex@example.com' }] },
      { client },
    );

    expect(result.error).toBeUndefined();
    expect(capturedRequest?.method).toBe('POST');
    expect(capturedRequest?.url).toBe(
      `https://example.test/v1/project/${projectId}/subscribers/invite`,
    );
    expect(await capturedRequest?.clone().json()).toEqual({
      subscribers: [{ name: 'Alex', email: 'alex@example.com' }],
    });
  });
});
