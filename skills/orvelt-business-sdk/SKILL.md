---
name: orvelt-business-sdk
description: Integrates the Orvelt Business API with the @orvelt/business TypeScript SDK. Use for server-side API authentication, questions, delivery links, rotating QR codes, opinions, answers, or subscriber invitations.
---

# Orvelt Business SDK

## Choose the integration

- Use this skill for authenticated server-side REST operations.
- For a feedback form on a website, use the sibling [opinion embed skill](../orvelt-opinion-embeds/SKILL.md). Embeds need only a project ID, never a Business API key.
- Install with `npm install @orvelt/business`. Read the installed package's `README.md`, `openapi.json`, and declarations under `dist/` for exact parameters and response types. Do not invent operations from the full HTTP API: the SDK exposes only the methods below.

## Configure server-side credentials

Keep API keys in server environment variables. Never expose them through browser bundles, public environment variables, URLs, or logs.

For a single credential, call `orvelt({ apiKey })` once at application startup. For multiple tenants or credentials, use isolated clients; never reconfigure the shared client per request:

```ts
import { createBusinessClient, opinions } from '@orvelt/business';

const apiKey = process.env.ORVELT_BUSINESS_API_KEY;
if (!apiKey) throw new Error('ORVELT_BUSINESS_API_KEY is required.');

const client = createBusinessClient({ apiKey });
const result = await opinions.list({ projectId: 'PROJECT_UUID', page: 1, limit: 20 }, { client });

if (result.error) throw new Error(result.error.message);
console.log({ count: result.data.opinions.length });
```

The production `baseUrl` is `https://api.orvelt.com/v1`. Override `baseUrl` for staging or a proxy; Node and Bun require an absolute HTTP(S) URL without credentials, query, or fragment.

## Use resource groups

| Export        | Methods                              |
| ------------- | ------------------------------------ |
| `questions`   | `list`, `create`, `update`, `delete` |
| `link`        | `list`, `create`, `resend`           |
| `qr`          | `display` (rotating only)            |
| `opinions`    | `list`                               |
| `answers`     | `list`                               |
| `subscribers` | `count`, `invite`                    |

Pass one flat parameter object: `link.resend({ projectId, id }, { client })`, not nested `path`, `query`, or `body` objects.

To bind a project, call `useProject(projectId)`. This is a plain factory, not a React hook:

```ts
import { useProject } from '@orvelt/business';

const project = useProject('PROJECT_UUID');
const result = await project.opinions.list({ page: 1, limit: 20 }, { client });
if (result.error) throw new Error(result.error.message);
```

The example assumes the isolated `client` above. Bound `qr.display({ client })` and `subscribers.count({ client })` take only operation options; other bound methods take parameters followed by options.

Do not use retired names such as `preverifiedLinks`, `preverification`, or `qrCodes`. Webhook management, opinion replies, and CSV exports are not SDK operations.

## Filters and delivery

- Opinions and answers support `query`, inclusive millisecond `dateFrom`/`dateTo`, exact `externalUserId`, sorting, and page-based pagination. Read each response's pagination metadata; neither list uses a cursor.
- Opinions also support `opinionId`, `visibility`, and `replyStatus`; answers support `responseId`, `questionId`, and `responseVisibility`. Each endpoint returns its own resource, with no `resource` selector.
- Answers belong to submitted responses and need not have an opinion.
- `externalUserId` and attributes are unverified reference metadata, not authentication or verification proof.
- `link.create` creates a preverified delivery link. Use its `sendEmail` option to choose delivery; there is no separate send-email method. Do not expose or log delivery tokens.

## Check results and test safely

SDK calls return `{ data, error }` by default. Check `error` before reading `data`; use `throwOnError: true` only when the application intends to handle thrown errors centrally.

Confirm the target project and environment before mutations, especially invitations, email delivery, question changes, and deletion. Use an isolated client's custom `fetch` for request-level tests instead of making live writes.
