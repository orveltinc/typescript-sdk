## @orvelt/business@0.1.8

### Required customer reference for links, and question versions

#### Links require a customer reference

`link.create` now requires `customerReference`, matching what the Business API already expects. Pass your own identifier for the customer, such as an order number, when you create a preverified link.

#### Create a new question version

`questions.versions.create` publishes new wording for a question as a new version. Earlier answers stay attached to the wording they were given for.

## @orvelt/business@0.1.7

### First public release of the TypeScript SDK

#### Call the Business API from your server

`@orvelt/business` exposes 12 operations from the Business API, with typed inputs and responses validated by Zod:

| Group              | Functions                            |
| ------------------ | ------------------------------------ |
| `questions`        | `list`, `create`, `update`, `delete` |
| `opinions`         | `list`                               |
| `answers`          | `list`                               |
| `preverifiedLinks` | `list`, `create`, `resend`           |
| `qrCodes`          | `display`                            |
| `subscribers`      | `count`, `invite`                    |

Configure the client once with `orvelt()`, or bind a project with `useProject()`. See [Configure the client](/docs/sdk/configure).

#### Embed the opinion form

Add the hosted opinion form to your website with the UNPKG script tag, or import `orveltEmbed` from the package. The SDK creates and resizes the iframe and reports completion. It needs only your public project ID, not an API key. See [Embed an opinion form](/docs/guides/embedded-opinions).
