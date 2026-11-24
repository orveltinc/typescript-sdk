## @orvelt/business@0.1.10

### Project end dates and visibility

Give a published project an end date and it closes itself at the end of that day: its page stays readable but takes no new opinions. A project's status is now `draft`, `published`, `closed`, or `archived`, and who can see it is its `visibility`, `public` or `private`. Projects return `visibility` and `endsAt` instead of `privateAt`, `project.create` and `project.update` take `visibility` instead of `isPrivate`, and `project.*` webhooks carry `visibility`. This is a breaking change for API clients.

### Duplicate a project

Duplicate a project from its settings. The copy is a draft with the original's questions, tags, goals, and appearance.

### Verification trails and shareable verifications

The verified badge on an opinion opens every verification on it and each step of its trail. Verification IDs are now 16-character codes, such as `7KQM3XHA9TPVW2RD`, that people can look up; earlier IDs no longer resolve. Verifications can be shared with a copied link or the QR code on their certificate.

### Verified purchases from Stripe

Connect a project to Stripe from **Integrations → Stripe** with a restricted key (**Webhook Endpoints: Write**; **Checkout Sessions**, **Invoices**, and **Charges: Read**). Each successful payment then issues the customer a purchase link, verified by the payment and usable for 90 days: Checkout and Payment Links, invoices that start a subscription or bill once, and payments outside both, such as the Payment Element or Terminal. Renewals and $0 invoices don't, and each payment issues at most one link. Each Stripe account connects to one project.

`link.create` takes `purchase: { provider: "stripe", customerId }` to reserve a link for a Stripe customer before they pay. It waits as `awaiting_payment`, and when that customer pays it becomes usable and fires the new `link.activated` webhook. Pass `notify: false` to issue it without an email; the customer still holds it through their email address. `link.list` returns each link's `type` and `purchase`.

Every link belongs to the email it was issued to. A signed-in customer with that verified email sees it under **Profile → Verifications** and can attach it to an opinion, and nobody else can use it.

Refunds and disputes don't undo a verification. They appear as steps on its trail (`payment_partially_refunded`, `payment_refunded`, `payment_disputed`, `dispute_won`, `dispute_lost`) and the verification stays verified.

**Integrations → Stripe** lists every payment with what it became, including why a payment issued no link, and shows whether Stripe can still reach Orvelt. Owners and admins are emailed when the plan's link limit stops Stripe payments from issuing links.

### Renamed link fields

This is a breaking change for API clients and webhook consumers. `link.create` takes `email`, `firstName`, `lastName`, and `reference` instead of `customerEmail`, `customerFirstName`, `customerLastName`, and `customerReference`; `notify` replaces `sendEmail`, and `purchase` replaces `stripeCustomerId`. `reference` is required for an invite and must be left out for a purchase link. Links return `notifiedAt`, `nextNotifyAt`, and `notifyError` instead of `emailedAt`, `nextEmailAt`, and `emailError`, and `link.*` webhooks carry the same fields. Update to SDK 0.1.10 when you update your calls.

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
