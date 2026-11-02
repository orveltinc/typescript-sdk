---
name: orvelt-opinion-embeds
description: Adds Orvelt feedback forms with the @orvelt/business keyless browser SDK. Use for opinion iframes, feedback modals, React or Next.js embed lifecycle, appearance, callbacks, and session resume.
---

# Orvelt opinion embeds

## Choose the integration

Use `orveltEmbed` from `@orvelt/business` to display the hosted opinion form using only a project ID. No API key, website backend, or manual session creation is needed. For authenticated REST calls, use the sibling [Business SDK skill](../orvelt-business-sdk/SKILL.md).

Install with `npm install @orvelt/business`. Read the installed package's `README.md` and `dist/browser.d.ts` for the full `OpinionEmbedConfiguration` type.

## Mount an iframe or open a modal

For inline placement, render `<div id="opinion-slot"></div>`, then:

```ts
import { orveltEmbed } from '@orvelt/business';

const embed = orveltEmbed.configure({
  projectId: 'PROJECT_UUID',
  visibility: 'public',
  onSubmitted: ({ isPrivate }) => console.log({ isPrivate }),
  onError: (error) => console.error(error.message),
});
await embed.mount('#opinion-slot');

// On component removal, navigation, logout, or a visitor change:
embed.unmount();
```

- `mount(target)` places one iframe inside a connected element. You own the layout, including any surrounding modal or drawer.
- `open()` opens Orvelt's modal. Call it from your own button; the SDK does not create a launcher.
- `close()` closes the SDK modal while keeping unfinished progress. Reopening after submission starts a new opinion.
- `unmount()` removes the iframe and its listeners. Call it before changing visitors.
- `mount()` resolving means the frame was inserted, not that the form is ready. Use `onReady` for readiness and `onError` for load failure or the readiness timeout.
- For deferred startup, configure `deferStart: true`, mount the frame, and call `start()` when the visitor should begin.

Configuration and imports are SSR-safe; `mount()` and `open()` need the browser. In React, mount inside an effect and return `() => embed.unmount()`; Next.js components using the loader must be client components. Include visitor-dependent options in lifecycle dependencies so a visitor change tears down the old iframe.

## Appearance and closing

```ts
const embed = orveltEmbed.configure({
  projectId: 'PROJECT_UUID',
  appearance: {
    accentColor: '#4f46e5',
    colorScheme: 'system',
    radius: 8,
  },
  onClose: () => console.log('Form closed'),
});
await embed.open();
```

`colorScheme` supports `light` (default), `dark`, or `system`; `radius` is an integer from 0 to 24 pixels. Use a hex accent color.

Style the host elements with `.orvelt-iframe`, `.orvelt-modal`, `.orvelt-modal::backdrop`, and `.orvelt-modal__iframe`. The frame resizes itself; do not fix its height. Cap it with `max-height` if necessary.

The SDK modal supports a close button, Escape, and backdrop clicks. With `mount()`, providing `onClose` shows the form's close button by default; the callback should hide your container. Unmount when finished with your own modal.

## Keep identity and sessions safe

- Never pass a Business API key to the embed or ship one to the browser.
- `externalUserId` is unverified reference metadata. Optional JSON `attributes` attach context to the opinion; do not include secrets. Neither bypasses visitor authentication.
- Orvelt creates a fresh visitor session inside a fresh iframe. Without a detected Orvelt account, the form collects name/email and verifies a code.
- Permanent installation uses the project ID, not a saved opinion session URL.
- `onSessionCreated(url)` returns an identifier-only resume URL. Reopen it with `configure({ projectId, sessionUrl: url })` only in the same tab and storage context, where the iframe retains its own credential. It is not a transferable bearer login; without the saved credential the frame starts a new session. Resuming preserves the original attributes.
- `onSubmitted` contains only `{ isPrivate }`, not author details. Do not treat it as proof of identity.
- Use the `origin` option for a staging storefront origin, not the Business API's `baseUrl`.

## Other entry points

`@orvelt/business/browser` exposes the same embed helpers for browser-only imports. Plain HTML can load the packaged `dist/opinion-embed.js` script and call `OrveltEmbed.configure(...)`; pin a version when loading from a package CDN.

For an iframe you create yourself, use `opinionEmbedUrl(configuration)` and `attachOpinionEmbed(iframe, callbacks)`. Call the returned disposer during cleanup; keep the SDK's origin/window message validation instead of adding an unrestricted `message` listener.

Test mount, readiness, submission callbacks, close/reopen, unmount, and visitor changes. Do not submit real feedback as an incidental integration check.
