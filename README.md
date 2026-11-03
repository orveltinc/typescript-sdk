# `@orvelt/business`

TypeScript client for the Orvelt Business API, plus browser opinion embed helpers. SDK REST calls require an API key; embeds do not. The SDK is distributed under the [Apache License 2.0](LICENSE).

## Browser installation

Install the npm package and import `orveltEmbed` from `@orvelt/business` to create and manage the hosted opinion iframe using only a project ID. No API key or website backend is required:

```sh
npm install @orvelt/business
```

Add `<div id="opinion-slot"></div>` to your page, then:

```ts
import { orveltEmbed } from '@orvelt/business';

const embed = orveltEmbed.configure({
  projectId: 'PROJECT_UUID',
  visibility: 'public',
  // Optional unverified reference metadata:
  externalUserId: 'reference-42',
  onSubmitted: ({ isPrivate }) => console.log({ isPrivate }),
});
await embed.mount('#opinion-slot');
// Cleanup on component unmount, Turbo navigation, logout, or account changes:
embed.unmount();
```

### Display methods

There are two ways to show the form:

| Method                            | Use it when                                                                    | Closing                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Iframe**: `embed.mount(target)` | The form sits in your page or inside your own modal/drawer. You own placement. | Pass `onClose` to show a close button in the form's top-right corner, then hide your container. |
| **Modal**: `embed.open()`         | You want Orvelt's modal, such as behind a "Give feedback" button.              | Close button (top-right), Escape, and backdrop click. `embed.close()` closes it from code.      |

```ts
const embed = orveltEmbed.configure({
  projectId: 'PROJECT_UUID',
  onClose: () => console.log('closed'),
});
document.querySelector('#open-feedback')?.addEventListener('click', () => void embed.open());
```

Closing an `open()` modal keeps the visitor's progress; reopening resumes it. After a submission, the next `open()` starts a new opinion. In your own modal, call `embed.unmount()` when you are done with the form.

### Appearance

```ts
orveltEmbed.configure({
  projectId: 'PROJECT_UUID',
  appearance: {
    accentColor: '#4f46e5', // Buttons, focus rings, and highlights; text contrast is automatic.
    colorScheme: 'system', // 'light' (default), 'dark', or 'system'.
    radius: 8, // Field and button corners in pixels, 0–24.
  },
});
```

The iframe and modal carry classes you can target from your own CSS. Their defaults have zero specificity, so any selector overrides them:

| Class                  | Element                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `orvelt-iframe`        | The iframe created by `mount()`.                                                       |
| `orvelt-modal`         | The `<dialog>` created by `open()`. Style its backdrop with `.orvelt-modal::backdrop`. |
| `orvelt-modal__iframe` | The iframe inside the modal.                                                           |

The SDK sets the iframe's `height` inline as the form resizes. Don't fix the height yourself; cap it with `max-height` instead.

Once the SDK is published to npm, plain HTML sites can load `https://unpkg.com/@orvelt/business/dist/opinion-embed.js` and use `OrveltEmbed.configure` with the same options. Omitting the version resolves npm's `latest` tag, subject to CDN/browser caching; already-open pages keep their loaded script. Add an exact version after `@orvelt/business` to control upgrades, or self-host the packaged `dist/opinion-embed.js`. SDK releases are independent of storefront deployments. For now, the example runner and package tests serve the built bundle locally without requiring publication. Configuration/imports are SSR-safe; call `mount()` or `open()` only in browser events/effects. Next.js components using the loader must be client components. The loader adds no launcher button of its own; a modal appears only when you call `open()`.

### Distribution checks

Release CI builds and packs the SDK, installs the tarball into separate npm, pnpm, Yarn Classic, Yarn 4, and Bun consumers, and checks authenticated requests and HTTP errors against a local server. Runtime matrices cover Node 20.19, 22, 24, 25, and 26, plus Bun 1.3.3 through selected 1.4 releases. Chromium checks the installed browser script's repeated loading, mount, readiness, resizing, submission callbacks, unmount, and modal close. The iframe is a protocol fixture; real opinion submission remains covered by the monorepo's cross-product browser suite.

The publishing job publishes that exact verified tarball. Stable releases update npm's `latest` tag; prereleases update `next`. No check currently depends on UNPKG or on this package already being published. Once publishing is available, live UNPKG checks can be added to verify CDN delivery separately.

To run package checks from this directory:

```sh
bun run build
mkdir -p test/results
bun pm pack --ignore-scripts --filename "$PWD/test/results/orvelt-business.tgz"
bunx playwright install chromium
bun run test-e2e
```

From the monorepo, `moon run business-sdk:test-e2e` builds, packs and runs the local package checks. The test-only script endpoint is `http://127.0.0.1:54810/opinion-embed.js` while Playwright is running; it is not part of the storefront.

Orvelt creates a separate visitor session inside each fresh iframe. `externalUserId` is unverified reference metadata; it never bypasses authentication. Without a detected Orvelt account, the form collects Name/Email and verifies a code before the opinion form opens. Session callbacks return identifier-only resume URLs, not bearer secrets. Resuming requires the iframe's own saved credential in the same tab and storage context; otherwise the frame starts a new session. Set `origin` for staging. Unmount before changing visitors.

The optional `@orvelt/business/browser` subpath remains available for browser-only imports. Both entries expose the same embed helpers and configuration type; neither requires an API key for embedding.

## Install

```sh
bun add @orvelt/business
```

The published package is ESM and supports Node.js 20.19 or newer and Bun 1.3.3
or newer. Bun 1.3.3 is the lowest version verified by the installed-consumer
HTTP test; Bun 1.3.11,
1.4.0, 1.4.2, and 1.4.4 also pass. It can
be installed with npm, pnpm, Yarn, or Bun; Bun is used only for this repository's
contributor tooling and is not required by consumers:

```sh
npm install @orvelt/business
pnpm add @orvelt/business
yarn add @orvelt/business
```

Node and Bun consumers need an absolute `http://` or `https://` `baseUrl` for
REST requests. The package has no runtime dependency on the workspace or on Bun.

## Agent skills

The npm package includes two Agent Skills:

- [`orvelt-business-sdk`](skills/orvelt-business-sdk/SKILL.md): server-side API authentication, clients, resource operations, and error handling.
- [`orvelt-opinion-embeds`](skills/orvelt-opinion-embeds/SKILL.md): keyless browser iframe and modal integration, lifecycle, and session safety.

After installing `@orvelt/business`, copy them into your agent's skills directory. For agents that read project skills from `.agents/skills`, run from your project root:

```sh
mkdir -p .agents/skills
cp -R node_modules/@orvelt/business/skills/. .agents/skills/
```

Use your agent's supported skills directory if it differs. Copy them again after upgrading the SDK to keep the instructions in sync. Installing the npm package alone does not register skills with your agent.

Tools can also locate a bundled skill with `import.meta.resolve('@orvelt/business/skills/orvelt-business-sdk/SKILL.md')`. Read the resolved file as Markdown; it is not a JavaScript module.

## Configure once

In Orvelt Business, open your organization's **API keys** page and create a key. Copy the secret when it is shown; you cannot view it again. Store it in your server's environment as `ORVELT_BUSINESS_API_KEY`, not in browser code or source control. CLI browser login does not configure SDK credentials.

```ts
import { orvelt, opinions } from '@orvelt/business';

orvelt({ apiKey: process.env.ORVELT_BUSINESS_API_KEY! });

const result = await opinions.list({
  projectId: 'PROJECT_UUID',
  page: 1,
  limit: 20,
});

if (result.error) throw new Error(result.error.message);
console.log({ count: result.data.opinions.length });
```

Grouped operations use a flat parameter object, so project-scoped calls pass `projectId` alongside query or body fields. For example, use `opinions.list({ projectId, page, limit })` or `link.resend({ projectId, id })`.

The SDK contains exactly 12 selected REST operations:

| Group         | Methods                              |
| ------------- | ------------------------------------ |
| `questions`   | `list`, `create`, `update`, `delete` |
| `link`        | `list`, `create`, `resend`           |
| `qr`          | `display` (rotating only)            |
| `opinions`    | `list`                               |
| `answers`     | `list`                               |
| `subscribers` | `count`, `invite`                    |

`openapi.json` covers only these SDK methods. For the full REST API and its authentication requirements, see the [HTTP API reference](https://resource.orvelt.com/docs/api-reference).

Opinions and answers support `query`, inclusive millisecond `dateFrom`/`dateTo`, exact `externalUserId`, sorting, and pagination. Opinions also support `opinionId`, `visibility`, and `replyStatus` (`all`, `replied`, or `unreplied`); answers support `responseId`, `questionId`, and `responseVisibility`. Answers belong to submitted responses and do not require an opinion. Each list returns only its own resource, with no `resource` selector. Filters combine before pagination. References are unverified metadata, not proof of identity. CSV downloads remain first-party, session-only export operations rather than public SDK methods.

The default base URL is `https://api.orvelt.com/v1`. Override it for staging or a local proxy:

```ts
orvelt({
  apiKey: process.env.ORVELT_BUSINESS_API_KEY!,
  baseUrl: 'https://staging-api.example.com/v1',
});
```

Use `createBusinessClient()` when clients need separate credentials or base URLs, then pass it as the second argument to an operation. Prefer isolated clients in servers handling multiple tenants: do not reconfigure the shared client per request. Calling `orvelt()` again replaces its supported options, including headers, custom fetch and error mode. The `apiKey` option takes precedence over an `x-api-key` supplied in client headers.

Base URLs must be HTTP(S) URLs without credentials, queries or fragments. Root-relative proxy paths such as `/v1` are browser-only; Node and Bun need an absolute URL. Never include Business API keys in frontend code; use the keyless embed helpers there.

```ts
import { createBusinessClient, opinions } from '@orvelt/business';

const client = createBusinessClient({ apiKey: 'ov_example' });
const result = await opinions.list({ projectId: 'PROJECT_UUID' }, { client });
```

For repeated calls against one project, use `useProject()` to bind the project ID once:

```ts
import { useProject } from '@orvelt/business';

const project = useProject('PROJECT_UUID');
const result = await project.opinions.list({
  externalUserId: 'customer-42',
  visibility: 'public',
});
```

`useProject()` is a plain factory and does not require React. Pass per-request options, including a custom client, as the operation's second argument.

JSON responses are validated with generated Zod schemas. SDK calls return `{ data, error, request, response }` by default; set `throwOnError: true` in the client options if errors should throw instead. For success-only TypeScript inference, also pass `throwOnError: true` per call. HTTP failures retain the server's error payload; network, cancellation, JSON parsing and validation failures may instead be native errors or `ZodError`. Check errors as `unknown` before reading API-specific fields. `request` and `response` can be absent on failures.

Pass `signal` in per-call options to cancel a request. The SDK does not automatically retry requests, particularly mutations; inspect the response and `Retry-After` before deciding whether retrying is safe.

## Embedded opinion forms

Register exact host origins under **Delivery → Embedded form**, then install the npm browser SDK and call `configure({ projectId })` followed by `mount(container)`. Orvelt handles visitor sessions; question and project-setting edits remain authenticated Business operations.

Pass optional `attributes` to `configure()` to attach arbitrary JSON metadata to the opinion, for example `attributes: { orderId: 'order-42', context: { tags: ['checkout'] } }`. Objects, arrays, primitives, and `null` are supported. Attributes are returned by the Business API, not public reviews, and do not establish identity or verification. Do not include secrets. Reopening with `sessionUrl` keeps that session's original attributes.

The project URL is reusable installation code. An identifier-only resume URL represents one opinion, whose session lasts one hour. Use `configure({ projectId, sessionUrl })` to reopen it in the same tab and storage context, not for permanent installation. The iframe keeps its bearer secret in its own origin's `sessionStorage`; without that saved credential it starts a new session.

The local playground includes **Copy session URL** and **Open an existing session**. The optional `onSessionCreated(url)` callback exposes the same identifier-only URL, never its bearer secret.

For an iframe you create yourself, `attachOpinionEmbed` adds resizing and completion handling and returns a disposer. Completion carries only `{ isPrivate }`, not author details.

See the [integration guide](https://resource.orvelt.com/docs/developers/collect/website-embed) and [`packages/examples/opinion-embeds`](../examples/opinion-embeds/README.md). Run `moon run examples:dev` to start all five examples together after configuring the server environment.

## Development

The committed `openapi.json` document is the source for the generated client. Install dependencies and regenerate the SDK with:

```sh
bun install
bun run generate
```

Run `bun run check-generated` to verify that the committed client matches the OpenAPI document. In the monorepo, use `moon run business-sdk:generate` to regenerate both the spec from the live contracts and the SDK; `check-generated` verifies both. Contract-generation tests run only in the monorepo. The standalone repository installs from explicit dependency versions and verifies the committed spec/client without importing private workspace packages.

The generator is pinned to `@hey-api/openapi-ts@0.99.0`. Its header-spread and tuple-iteration bugs are corrected by `scripts/fix-generated-headers.ts` during generation so records, `Headers` and tuple arrays work consistently, including repeated tuple values and explicit header deletion. The workaround fails on unrecognized output; review/remove it when upgrading the generator. Never patch `src/generated` by hand.

Create the npm-compatible artifact with `bun pm pack` after building. Version tags identify releases and run verification; they do not publish automatically. After the initial npm publication, run the **Business SDK** workflow manually on this repository's `main` branch to verify and publish its exact tarball through npm trusted publishing. See [release preparation](RELEASING.md).
