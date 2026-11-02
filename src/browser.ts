import { z } from 'zod';
import { zOpinionEmbedConfiguration } from './generated/zod.gen.js';

const messageSchema = z.discriminatedUnion('type', [
  z.object({
    source: z.literal('orvelt-opinion-embed'),
    type: z.literal('opinion-ready'),
  }),
  z.object({
    source: z.literal('orvelt-opinion-embed'),
    type: z.literal('opinion-session-created'),
    url: z.url(),
  }),
  z.object({
    source: z.literal('orvelt-opinion-embed'),
    type: z.literal('resize'),
    height: z.number().int().nonnegative(),
  }),
  z.object({
    source: z.literal('orvelt-opinion-embed'),
    type: z.literal('opinion-submitted'),
    isPrivate: z.boolean(),
  }),
  z.object({
    source: z.literal('orvelt-opinion-embed'),
    type: z.literal('close-requested'),
  }),
]);

/** Attaches only to your iframe; ignores messages from other origins/windows. */
export function attachOpinionEmbed(
  iframe: HTMLIFrameElement,
  options: {
    onSubmitted?: (result: { isPrivate: boolean }) => void;
    onSessionCreated?: (url: string) => void;
    onReady?: () => void;
    /** The visitor pressed the form's close button (shown when the URL has `closeButton: true`). */
    onClose?: () => void;
  } = {},
) {
  const host = iframe.ownerDocument.defaultView;
  if (!host) throw new TypeError('The iframe must belong to a browser document.');
  const origin = new URL(iframe.src, host.location.href).origin;
  const receive = (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== iframe.contentWindow) return;
    const parsed = messageSchema.safeParse(event.data);
    if (!parsed.success) return;
    if (parsed.data.type === 'opinion-ready') {
      options.onReady?.();
    } else if (parsed.data.type === 'resize') {
      iframe.style.height = `${Math.max(200, Math.min(parsed.data.height, 2000))}px`;
    } else if (parsed.data.type === 'opinion-session-created') {
      const sessionUrl = new URL(parsed.data.url);
      const fragment = new URLSearchParams(sessionUrl.hash.slice(1));
      if (
        sessionUrl.origin === origin &&
        sessionUrl.pathname === new URL(iframe.src).pathname &&
        !sessionUrl.username &&
        !sessionUrl.password &&
        [...fragment.keys()].length === 1 &&
        z.uuid().safeParse(fragment.get('session')).success
      )
        options.onSessionCreated?.(sessionUrl.href);
    } else if (parsed.data.type === 'close-requested') {
      options.onClose?.();
    } else options.onSubmitted?.({ isPrivate: parsed.data.isPrivate });
  };
  host.addEventListener('message', receive);
  return () => host.removeEventListener('message', receive);
}

const configurationSchema = zOpinionEmbedConfiguration.extend({
  /** Arbitrary JSON metadata saved with the opinion; not public identity or verification proof. */
  attributes: z.json().optional(),
  externalUserId: z
    .string()
    .trim()
    .pipe(zOpinionEmbedConfiguration.shape.externalUserId.unwrap())
    .optional(),
  /** Optional storefront origin. Defaults to https://orvelt.com; override for staging or local development. */
  origin: z.url().default('https://orvelt.com'),
  /** Identifier-only resume URL. Reopens only where the iframe has its own saved credential. */
  sessionUrl: z.url().optional(),
  /** Render now, but defer session/workflow startup until the host calls start(). */
  deferStart: z.boolean().default(false),
  /**
   * Show a close button in the form's top-right corner. Defaults to on for open() and, for
   * mount(), whenever onClose is set. Pressing it calls onClose.
   */
  closeButton: z.boolean().optional(),
  /** Styles inside the form. Style the iframe and modal from your page with the `orvelt-*` classes. */
  appearance: z
    .object({
      /** Hex color for buttons, focus rings, and highlights, such as '#4f46e5'. */
      accentColor: z
        .string()
        .regex(/^#(?:[0-9a-f]{3}){1,2}$/i, 'Use a hex color such as #4f46e5.')
        .optional(),
      /** Defaults to 'light'; 'system' follows the visitor's device setting. */
      colorScheme: z.enum(['light', 'dark', 'system']).optional(),
      /** Corner radius of fields and buttons, in pixels. */
      radius: z.number().int().min(0).max(24).optional(),
    })
    .optional(),
});
export type OpinionEmbedConfiguration = z.input<typeof configurationSchema> & {
  onSubmitted?: (result: { isPrivate: boolean }) => void;
  onSessionCreated?: (url: string) => void;
  onReady?: () => void;
  /** Called when the iframe cannot load or does not become ready within 15 seconds. */
  onError?: (error: Error) => void;
  /** The visitor closed the form: its close button, or Escape/backdrop click in open() mode. */
  onClose?: () => void;
};

function setPresentation(url: URL, configuration: z.output<typeof configurationSchema>) {
  const { accentColor, colorScheme, radius } = configuration.appearance ?? {};
  if (accentColor) {
    const hex = accentColor.slice(1).toLowerCase();
    url.searchParams.set(
      'accent',
      `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`,
    );
  }
  if (colorScheme) url.searchParams.set('theme', colorScheme);
  if (radius !== undefined) url.searchParams.set('radius', String(radius));
  if (configuration.closeButton) url.searchParams.set('close', 'button');
}

/** Frontend-only installation URL. Orvelt creates the visitor session inside the iframe. */
export function opinionEmbedUrl(options: OpinionEmbedConfiguration): string {
  const configuration = configurationSchema.parse({
    ...options,
    closeButton: options.closeButton ?? Boolean(options.onClose),
  });
  const origin = new URL(configuration.origin);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new TypeError('Use an HTTP(S) storefront origin without credentials, paths, or queries.');
  if (configuration.sessionUrl) {
    const url = new URL(configuration.sessionUrl);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const sessionId = fragment.get('session');
    if (
      url.origin !== origin.origin ||
      url.username ||
      url.password ||
      url.pathname !== `/embed/opinion/${configuration.projectId}` ||
      [...fragment.keys()].length !== 1 ||
      !z.uuid().safeParse(sessionId).success
    )
      throw new TypeError(
        'Use an identifier-only resume URL for this project and storefront, without a bearer token.',
      );
    if (configuration.deferStart) url.searchParams.set('startup', 'deferred');
    setPresentation(url, configuration);
    return url.href;
  }
  const url = new URL(`/embed/opinion/${configuration.projectId}`, origin);
  url.searchParams.set('visibility', configuration.visibility);
  if (configuration.externalUserId)
    url.searchParams.set('externalUserId', configuration.externalUserId);
  if (configuration.attributes !== undefined)
    url.hash = new URLSearchParams({
      attributes: JSON.stringify(configuration.attributes),
    }).toString();
  if (configuration.deferStart) url.searchParams.set('startup', 'deferred');
  setPresentation(url, configuration);
  return url.href;
}

/**
 * Zero-specificity defaults, so any selector on your page overrides them; unlayered, so they still
 * beat layered resets such as Tailwind's preflight. Adopted rather than
 * inserted as a <style> element so pages with a strict style-src CSP still get them.
 */
const EMBED_STYLES = `
:where(.orvelt-iframe, .orvelt-modal__iframe) { display: block; width: 100%; border: 0; }
:where(.orvelt-modal) {
  /* Restates the dialog centering that CSS resets such as Tailwind's \`* { margin: 0 }\` remove. */
  position: fixed; inset: 0; height: fit-content; margin: auto;
  box-sizing: border-box; width: min(36rem, calc(100vw - 2rem)); max-width: none;
  max-height: min(40rem, calc(100dvh - 2rem)); padding: 0; border: 0; border-radius: 12px;
  overflow: hidden; background: Canvas; box-shadow: 0 24px 64px rgb(0 0 0 / 0.3);
}
:where(.orvelt-modal)::backdrop { background: rgb(0 0 0 / 0.5); }
:where(.orvelt-modal__iframe) { max-height: min(40rem, calc(100dvh - 2rem)); }
:where(html:has(.orvelt-modal[open])) { overflow: hidden; }
`;
const styledDocuments = new WeakSet<Document>();
/** Returns false where constructable stylesheets are unavailable (older browsers, test DOMs). */
function adoptEmbedStyles(document: Document) {
  if (styledDocuments.has(document)) return true;
  const Sheet = document.defaultView?.CSSStyleSheet;
  if (!document.adoptedStyleSheets || typeof Sheet?.prototype.replaceSync !== 'function')
    return false;
  const sheet = new Sheet();
  sheet.replaceSync(EMBED_STYLES);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  styledDocuments.add(document);
  return true;
}

/**
 * SSR-safe. No API key, business server, fetch, or customer authentication is performed here.
 * mount() places the iframe in your element (your layout or modal); open() shows it in an
 * Orvelt-managed modal. One configured embed shows at most one form at a time.
 */
export function createOpinionEmbed(options: OpinionEmbedConfiguration) {
  const inlineUrl = opinionEmbedUrl(options);
  // Validated with the rest of the configuration; the modal always offers a way out.
  const modalUrl = opinionEmbedUrl({ ...options, closeButton: true });
  const origin = new URL(inlineUrl).origin;
  let iframe: HTMLIFrameElement | null = null;
  let container: HTMLElement | null = null;
  let dialog: HTMLDialogElement | null = null;
  let removeDialog: (() => void) | undefined;
  let detach: (() => void) | undefined;
  let pending: Promise<HTMLIFrameElement> | undefined;
  let ready = false;
  let submitted = false;
  let cancelReadinessTimeout: (() => void) | undefined;
  let startRequested = !options.deferStart;
  function start() {
    startRequested = true;
    if (!ready || !iframe) return;
    iframe.contentWindow?.postMessage(
      { source: 'orvelt-opinion-host', type: 'start-opinion' },
      origin,
    );
  }
  function unmount() {
    cancelReadinessTimeout?.();
    cancelReadinessTimeout = undefined;
    detach?.();
    detach = undefined;
    iframe?.remove();
    iframe = null;
    removeDialog?.();
    removeDialog = undefined;
    dialog = null;
    container = null;
    pending = undefined;
    ready = false;
    submitted = false;
    startRequested = !options.deferStart;
  }
  /** Closes the modal; a closed modal keeps the visitor's progress until it is submitted. */
  function close() {
    dialog?.close();
  }
  function place(element: HTMLElement, host: Window, src: string, className: string) {
    const styled = adoptEmbedStyles(element.ownerDocument);
    container = element;
    const frame = element.ownerDocument.createElement('iframe');
    frame.className = className;
    frame.title = 'Orvelt opinion form';
    frame.allow = 'microphone';
    frame.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
    );
    frame.referrerPolicy = 'no-referrer';
    // Stay compact before hydration; resize messages then fit the content up to the CSS cap.
    frame.style.height = className === 'orvelt-modal__iframe' ? '400px' : '700px';
    if (!styled) Object.assign(frame.style, { width: '100%', border: '0', display: 'block' });
    frame.src = src;
    detach = attachOpinionEmbed(frame, {
      onSubmitted: (result) => {
        submitted = true;
        options.onSubmitted?.(result);
      },
      onSessionCreated: options.onSessionCreated,
      onReady: () => {
        if (iframe !== frame) return;
        ready = true;
        cancelReadinessTimeout?.();
        cancelReadinessTimeout = undefined;
        options.onReady?.();
        if (startRequested) start();
      },
      onClose: () => (dialog ? close() : options.onClose?.()),
    });
    iframe = frame;
    if (options.onError) {
      let reported = false;
      const reportFailure = () => {
        if (iframe !== frame || ready || reported) return;
        reported = true;
        options.onError?.(new Error('The opinion form could not be loaded.'));
      };
      frame.addEventListener('error', reportFailure);
      const timeout = host.setTimeout(reportFailure, 15_000);
      cancelReadinessTimeout = () => {
        host.clearTimeout(timeout);
        frame.removeEventListener('error', reportFailure);
      };
    }
    element.append(frame);
    pending = Promise.resolve(frame);
    return pending;
  }
  /** Places the iframe in your element, such as a page section or your own modal. */
  function mount(target: HTMLElement | string): Promise<HTMLIFrameElement> {
    const element =
      typeof target === 'string' ? globalThis.document?.querySelector<HTMLElement>(target) : target;
    const host = element?.ownerDocument.defaultView;
    if (!element || !host || !element.isConnected)
      return Promise.reject(new TypeError('Mount the form into a connected browser element.'));
    if (container === element && !dialog && iframe?.isConnected)
      return pending ?? Promise.resolve(iframe);
    unmount();
    return place(element, host, inlineUrl, 'orvelt-iframe');
  }
  /**
   * Shows the form in a modal with a close button, Escape, and backdrop click. Reopening after a
   * close resumes the same opinion; after a submission it starts a new one.
   */
  function open(): Promise<HTMLIFrameElement> {
    const document = globalThis.document;
    const host = document?.defaultView;
    if (!document?.body || !host)
      return Promise.reject(new TypeError('Open the form from a browser page.'));
    if (dialog?.isConnected && iframe?.isConnected) {
      if (!dialog.open) dialog.showModal();
      return pending ?? Promise.resolve(iframe);
    }
    unmount();
    const modal = document.createElement('dialog');
    modal.className = 'orvelt-modal';
    modal.setAttribute('aria-label', 'Share your opinion');
    const scheme = options.appearance?.colorScheme ?? 'light';
    // Matches the form's background while it loads.
    modal.style.colorScheme = scheme === 'system' ? 'light dark' : scheme;
    const onClosed = () => {
      if (submitted) unmount();
      options.onClose?.();
    };
    const onClick = (event: MouseEvent) => {
      // The iframe fills the dialog, so a click on the dialog itself is on the backdrop.
      if (event.target === modal) modal.close();
    };
    modal.addEventListener('close', onClosed);
    modal.addEventListener('click', onClick);
    removeDialog = () => {
      modal.removeEventListener('close', onClosed);
      modal.removeEventListener('click', onClick);
      if (modal.open) modal.close();
      modal.remove();
    };
    document.body.append(modal);
    dialog = modal;
    const frame = place(modal, host, modalUrl, 'orvelt-modal__iframe');
    modal.showModal();
    return frame;
  }
  return { mount, open, close, start, unmount };
}

/** Same frontend-only API for npm and the standalone HTML script. */
export const orveltEmbed = { configure: createOpinionEmbed };
