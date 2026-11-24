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

Create one `Orvelt` client per credential, once at application startup, and reuse it. Pass the key alone, or `new Orvelt({ apiKey, baseUrl, headers, fetch, throwOnError })` to set other options (type `OrveltOptions`). Each instance keeps its own credentials, so for multiple tenants, organizations, or environments create one instance each; never share one instance across credentials or rebuild it per request:

```ts
import { Orvelt } from '@orvelt/business';

const apiKey = process.env.ORVELT_BUSINESS_API_KEY;
if (!apiKey) throw new Error('ORVELT_BUSINESS_API_KEY is required.');

const orvelt = new Orvelt(apiKey);
const { data, error } = await orvelt.opinions.list({
  projectId: 'PROJECT_UUID',
  page: 1,
  limit: 20,
});

if (error) throw new Error(error.message);
console.log({ count: data.opinions.length });
```

The production `baseUrl` is `https://api.orvelt.com/v1`. Override `baseUrl` for staging or a proxy; Node and Bun require an absolute HTTP(S) URL without credentials, query, or fragment.

## Use resource groups

| Group                | Methods                              |
| -------------------- | ------------------------------------ |
| `questions`          | `list`, `create`, `update`, `delete` |
| `questions.versions` | `create`                             |
| `link`               | `list`, `create`, `resend`           |
| `qr`                 | `display` (rotating only)            |
| `opinions`           | `list`                               |
| `answers`            | `list`                               |
| `subscribers`        | `count`, `invite`                    |

These groups exist only on an `Orvelt` instance. Every method takes one flat parameter object that includes `projectId`, such as `orvelt.link.resend({ projectId, id })` or `orvelt.qr.display({ projectId })`, not nested `path`, `query`, or `body` objects. An optional second argument holds per-request options such as `headers`, `signal`, or `throwOnError`.

Do not use retired names such as `preverifiedLinks`, `preverification`, or `qrCodes`. Webhook management, opinion replies, and CSV exports are not SDK operations.

## Filters and delivery

- Opinions and answers support `query`, inclusive millisecond `dateFrom`/`dateTo`, exact `externalUserId`, sorting, and page-based pagination. Read each response's pagination metadata; neither list uses a cursor.
- Opinions also support `opinionId`, `visibility`, and `replyStatus`; answers support `responseId`, `questionId`, and `responseVisibility`. Each endpoint returns its own resource, with no `resource` selector.
- Answers belong to submitted responses and need not have an opinion.
- `externalUserId` and attributes are unverified reference metadata, not authentication or verification proof.
- `link.create` creates a preverified delivery link: an invite, or with `purchase: { provider, customerId }`, a link reserved for a customer of a connected integration until they pay. Use its `notify` option to choose delivery; there is no separate notify method. Do not expose or log delivery tokens.

## Check results and test safely

SDK calls return `{ data, error }` by default. Check `error` before reading `data`; use `throwOnError: true` only when the application intends to handle thrown errors centrally.

Confirm the target project and environment before mutations, especially invitations, email delivery, question changes, and deletion. Pass a custom `fetch` to a test-only `Orvelt` instance for request-level tests instead of making live writes.
