# `@orvelt/business`

TypeScript client for the public Orvelt Business REST API. It contains only operations that accept project-scoped Business API keys; browser-session-only dashboard procedures are intentionally excluded.

## Install

```sh
bun add @orvelt/business
```

## Configure once

```ts
import { orvelt, goals } from '@orvelt/business';

orvelt({ apiKey: process.env.ORVELT_BUSINESS_API_KEY! });

const result = await goals.list({
  projectId: 'PROJECT_UUID',
  page: 1,
  limit: 20,
});

if (result.error) throw new Error(result.error.message);
console.log(result.data.goals);
```

Grouped operations use a flat parameter object, so project-scoped calls pass `projectId` alongside query or body fields. For example, use `goals.list({ projectId, page, limit })` or `opinions.respond({ projectId, id, content })`.

The default base URL is `https://api.orvelt.com/v1`. Override it for staging or a local proxy:

```ts
orvelt({
  apiKey: process.env.ORVELT_BUSINESS_API_KEY!,
  baseUrl: 'https://staging-api.example.com/v1',
});
```

Use `createBusinessClient()` when clients need separate credentials or base URLs, then pass it as the second argument to an operation.

```ts
import { createBusinessClient, opinions } from '@orvelt/business';

const client = createBusinessClient({ apiKey: 'ov_example' });
const result = await opinions.list({ projectId: 'PROJECT_UUID' }, { client });
```

For repeated calls against one project, use `useProject()` to bind the project ID once:

```ts
import { useProject } from '@orvelt/business';

const project = useProject('PROJECT_UUID');
const result = await project.opinions.respond({
  id: 'OPINION_ID',
  content: 'Thanks for sharing your feedback.',
});
```

`useProject()` is a plain factory and does not require React. Pass per-request options, including a custom client, as the operation's second argument.

Responses are validated with generated Zod schemas. SDK calls return `{ data, error, request, response }` by default; set `throwOnError: true` in the client options if errors should throw instead.

## Development

The committed `openapi.json` document is the source for the generated client. Install dependencies and regenerate the SDK with:

```sh
bun install
bun run generate
```

Run `bun run check-generated` to verify that the committed client matches the OpenAPI document. Tags named `v<package-version>` publish the package to npm after verification succeeds.
