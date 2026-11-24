import { describe, expect, it } from 'bun:test';
import { Orvelt } from '../../src/index.ts';
import * as sdk from '../../src/index.ts';

const projectId = '00000000-0000-0000-0000-000000000000';

/** A fetch that records each request and answers with `body`. */
function recordingFetch(body: unknown = {}) {
  const requests: Request[] = [];
  const fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return Response.json(body);
  }) as typeof globalThis.fetch;
  return { requests, fetch };
}

function expectMethods(group: object, names: string[]) {
  for (const name of names)
    expect((group as Record<string, unknown>)[name], name).toEqual(expect.any(Function));
}

describe('Business SDK', () => {
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
  it('exposes one client class and none of the retired entry points', () => {
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
      'orvelt',
      'configureBusinessSdk',
      'createBusinessClient',
      'businessClient',
      'useProject',
      'project',
      'questions',
      'link',
      'qr',
      'opinions',
      'answers',
      'subscribers',
      'linkCreate',
      'opinionsList',
      'OrveltSdk',
    ]) {
      expect(sdk).not.toHaveProperty(name);
    }
    const orvelt = new Orvelt('ov_test_key');
    for (const name of ['preverifiedLinks', 'qrCodes', 'preverification', 'goals', 'tags'])
      expect(orvelt).not.toHaveProperty(name);
    expect(orvelt.subscribers).not.toHaveProperty('block');
  });

  it('exposes every operation under its resource', () => {
    const orvelt = new Orvelt('ov_test_key');
    expectMethods(orvelt.questions, ['list', 'create', 'update', 'delete']);
    expectMethods(orvelt.questions.versions, ['create']);
    expectMethods(orvelt.link, ['list', 'create', 'resend']);
    expectMethods(orvelt.qr, ['display']);
    expectMethods(orvelt.opinions, ['list']);
    expectMethods(orvelt.answers, ['list']);
    expectMethods(orvelt.subscribers, ['count', 'invite']);
  });

  it('sends flat parameters to the route, query and body they belong to', async () => {
    const { requests, fetch } = recordingFetch({
      opinions: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    const orvelt = new Orvelt({ apiKey: 'ov_test_key', baseUrl: 'https://example.test/v1', fetch });

    const result = await orvelt.opinions.list({ projectId, page: 1, limit: 10 });
    await orvelt.subscribers.invite({
      projectId,
      subscribers: [{ name: 'Alex', email: 'alex@example.com' }],
    });

    expect(result.data?.opinions).toEqual([]);
    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ['GET', `https://example.test/v1/project/${projectId}/opinions?page=1&limit=10`],
      ['POST', `https://example.test/v1/project/${projectId}/subscribers/invite`],
    ]);
    expect(await requests[1]?.clone().json()).toEqual({
      subscribers: [{ name: 'Alex', email: 'alex@example.com' }],
    });
  });

  it('keeps each instance on its own key, so one process can serve several organizations', async () => {
    const { requests, fetch } = recordingFetch();
    const first = new Orvelt({ apiKey: 'ov_first', fetch });
    const second = new Orvelt('ov_second');

    await Promise.all([
      first.link.create({
        projectId,
        email: 'alex@example.com',
        firstName: 'Alex',
        purchase: { provider: 'stripe', customerId: 'cus_Nffrfeu8E2mW3A' },
      }),
      second.subscribers.count({ projectId }, { fetch }),
    ]);

    expect(
      requests.map((request) => [request.method, request.url, request.headers.get('x-api-key')]),
    ).toEqual([
      ['POST', `https://api.orvelt.com/v1/project/${projectId}/link`, 'ov_first'],
      ['GET', `https://api.orvelt.com/v1/project/${projectId}/subscribers/count`, 'ov_second'],
    ]);
    expect(await requests[0]?.clone().json()).toMatchObject({
      purchase: { provider: 'stripe', customerId: 'cus_Nffrfeu8E2mW3A' },
    });
  });
});
