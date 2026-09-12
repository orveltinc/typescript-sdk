import { describe, expect, it } from 'bun:test';
import {
  answers,
  goals,
  knowledgeBase,
  opinions,
  platformGoals,
  preverifiedLinks,
  project,
  questions,
  subscribers,
  useProject,
  webhooks,
} from '../../src/index.ts';
import { createBusinessClient } from '../../src/config.ts';

const projectId = '00000000-0000-0000-0000-000000000000';

function expectFunctions(value: object, keys: string[]) {
  expect(Object.keys(value)).toEqual(keys);
  for (const key of keys) {
    expect(value[key as keyof typeof value]).toEqual(expect.any(Function));
  }
}

describe('grouped Business SDK API', () => {
  it('exposes every operation under its resource', () => {
    expectFunctions(goals, ['list', 'create', 'update', 'delete']);
    expectFunctions(questions, ['list', 'create', 'update', 'delete']);
    expectFunctions(platformGoals, ['get', 'update']);
    expectFunctions(preverifiedLinks, ['list', 'create']);
    expectFunctions(opinions, ['list', 'respond']);
    expectFunctions(answers, ['list']);
    expectFunctions(subscribers, ['list', 'block']);
  });

  it('keeps project groups as a compatibility alias', () => {
    expect(project.goals).toBe(goals);
    expect(project.questions).toBe(questions);
    expect(project.platformGoals).toBe(platformGoals);
    expect(project.preverifiedLinks).toBe(preverifiedLinks);
    expect(project.opinions).toBe(opinions);
    expect(project.answers).toBe(answers);
    expect(project.subscribers).toBe(subscribers);
  });

  it('exposes organization operations under their resource', () => {
    expectFunctions(knowledgeBase, ['get', 'add', 'update', 'delete']);
    expect(Object.keys(webhooks)).toEqual(['portal', 'destinations']);
    expect(webhooks.portal).toEqual(expect.any(Function));
    expectFunctions(webhooks.destinations, ['upsert']);
  });

  it('creates a project-scoped facade without project parameters', () => {
    const scopedProject = useProject(projectId);

    expectFunctions(scopedProject.goals, ['list', 'create', 'update', 'delete']);
    expectFunctions(scopedProject.questions, ['list', 'create', 'update', 'delete']);
    expectFunctions(scopedProject.platformGoals, ['get', 'update']);
    expectFunctions(scopedProject.preverifiedLinks, ['list', 'create']);
    expectFunctions(scopedProject.opinions, ['list', 'respond']);
    expectFunctions(scopedProject.answers, ['list']);
    expectFunctions(scopedProject.subscribers, ['list', 'block']);
  });

  it('passes flattened project parameters to the generated operation', async () => {
    let capturedRequest: Request | undefined;
    const client = createBusinessClient({
      apiKey: 'ov_test_key',
      baseUrl: 'https://example.test/v1',
      fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
        capturedRequest = new Request(input, init);
        return Response.json({
          goals: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
      }) as typeof fetch,
    });

    const result = await goals.list({ projectId, page: 1, limit: 10 }, { client });

    expect(result.data?.goals).toEqual([]);
    expect(capturedRequest?.method).toBe('GET');
    expect(capturedRequest?.url).toBe(
      `https://example.test/v1/project/${projectId}/goals?page=1&limit=10`,
    );
  });

  it('injects the project ID into scoped operations', async () => {
    const opinionId = '11111111-1111-4111-8111-111111111111';
    let capturedRequest: Request | undefined;
    const client = createBusinessClient({
      apiKey: 'ov_test_key',
      baseUrl: 'https://example.test/v1',
      fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
        capturedRequest = new Request(input, init);
        return Response.json({
          ownerResponse: {
            id: 'response-id',
            reviewId: 'review-id',
            content: 'Thanks for sharing your feedback.',
            createdAt: '2025-01-01T00:00:00.000Z',
            user: { id: null, name: 'Business', avatarUrl: null },
          },
        });
      }) as typeof fetch,
    });

    const scopedProject = useProject(projectId);
    const result = await scopedProject.opinions.respond(
      { id: opinionId, content: 'Thanks for sharing your feedback.' },
      { client },
    );

    expect(result.error).toBeUndefined();
    expect(capturedRequest?.method).toBe('POST');
    expect(capturedRequest?.url).toBe(
      `https://example.test/v1/project/${projectId}/opinions/${opinionId}/responses`,
    );
    expect(await capturedRequest?.clone().json()).toEqual({
      content: 'Thanks for sharing your feedback.',
    });
  });
});
