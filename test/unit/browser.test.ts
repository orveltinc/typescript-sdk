import { describe, expect, it } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { attachOpinionEmbed, orveltEmbed, opinionEmbedUrl } from '../../src/index';
import { buildOpinionEmbedScript } from '../../scripts/build-browser';

function fixture() {
  const host = new EventTarget();
  Object.assign(host, { location: { href: 'https://business.example/' } });
  const source = {};
  const frame = {
    src: `https://orvelt.com/embed/opinion/${projectId}`,
    contentWindow: source,
    ownerDocument: { defaultView: host },
    style: { height: '700px' },
  };
  const send = (data: unknown, origin = 'https://orvelt.com', eventSource: object = source) => {
    const event = new Event('message');
    Object.assign(event, { data, origin, source: eventSource });
    host.dispatchEvent(event);
  };
  return { frame, send };
}
const resize = { source: 'orvelt-opinion-embed', type: 'resize', height: 800 };

describe('credential-free iframe helper', () => {
  it('resizes only the existing trusted frame and detaches cleanly', () => {
    const { frame, send } = fixture();
    const detach = attachOpinionEmbed(frame as unknown as HTMLIFrameElement);
    send(resize, 'https://attacker.example');
    send(resize, 'https://orvelt.com', {});
    send({ ...resize, source: 'different-source' });
    send({ ...resize, height: -1 });
    expect(frame.style.height).toBe('700px');
    send(resize);
    expect(frame.style.height).toBe('800px');
    send({ ...resize, height: 999999 });
    expect(frame.style.height).toBe('2000px');
    detach();
    send(resize);
    expect(frame.style.height).toBe('2000px');
  });
  it('forwards only the submission visibility, not customer data', () => {
    const { frame, send } = fixture();
    const results: unknown[] = [];
    const detach = attachOpinionEmbed(frame as unknown as HTMLIFrameElement, {
      onSubmitted: (result) => results.push(result),
    });
    send({
      source: 'orvelt-opinion-embed',
      type: 'opinion-submitted',
      isPrivate: true,
      externalUserId: 'secret',
    });
    expect(results).toEqual([{ isPrivate: true }]);
    detach();
  });
});

const projectId = '019a0000-0000-7000-8000-000000000001';
const sessionUrl = `https://orvelt.com/embed/opinion/${projectId}#session=019a0000-0000-7000-8000-000000000002`;

function managedFixture() {
  const host = new EventTarget();
  const requests: { url: URL; options: RequestInit }[] = [];
  const frames: Record<string, unknown>[] = [];
  const startMessages: { message: unknown; origin: string }[] = [];
  const timeouts = new Map<number, () => void>();
  let nextTimeout = 0;
  Object.assign(host, {
    setTimeout: (callback: () => void) => {
      timeouts.set(++nextTimeout, callback);
      return nextTimeout;
    },
    clearTimeout: (id: number) => timeouts.delete(id),
    location: { href: 'https://business.example/account', origin: 'https://business.example' },
    fetch: async (url: URL, options: RequestInit) => {
      requests.push({ url, options });
      throw new Error('The frontend loader must never fetch from a business server.');
    },
  });
  const document = {
    defaultView: host,
    createElement: () => {
      const events = new EventTarget();
      const frame = {
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        ownerDocument: document,
        style: {},
        src: '',
        contentWindow: {
          postMessage: (message: unknown, origin: string) =>
            startMessages.push({ message, origin }),
        },
        isConnected: false,
        setAttribute: (name: string, value: string) => {
          Object.assign(frame, { [name]: value });
        },
        remove: () => {
          frame.isConnected = false;
        },
      };
      frames.push(frame);
      return frame;
    },
  };
  const target = {
    ownerDocument: document,
    isConnected: true,
    append: (frame: { isConnected: boolean }) => {
      frame.isConnected = true;
    },
  } as unknown as HTMLElement;
  return { target, host, requests, frames, startMessages, timeouts };
}

describe('frontend-only opinion embed', () => {
  it('mounts deferred forms immediately and releases startup only after the trusted frame is ready', async () => {
    const { target, host, requests, startMessages } = managedFixture();
    const embed = orveltEmbed.configure({ projectId, deferStart: true });
    const frame = await embed.mount(target);
    expect(new URL(frame.src).searchParams.get('startup')).toBe('deferred');
    expect(requests).toHaveLength(0);
    expect(startMessages).toHaveLength(0);
    embed.start();
    expect(startMessages).toHaveLength(0);
    const ready = (source: unknown, origin = 'https://orvelt.com') => {
      const event = new Event('message');
      Object.assign(event, {
        source,
        origin,
        data: { source: 'orvelt-opinion-embed', type: 'opinion-ready' },
      });
      host.dispatchEvent(event);
    };
    ready({}, 'https://orvelt.com');
    ready(frame.contentWindow, 'https://attacker.example');
    expect(startMessages).toHaveLength(0);
    ready(frame.contentWindow);
    expect(startMessages).toEqual([
      {
        message: { source: 'orvelt-opinion-host', type: 'start-opinion' },
        origin: 'https://orvelt.com',
      },
    ]);
    embed.unmount();
    const next = await embed.mount(target);
    ready(next.contentWindow);
    expect(startMessages).toHaveLength(1);
    embed.start();
    expect(startMessages).toHaveLength(2);
    embed.unmount();
  });

  it('reports blocked or unavailable frames once and cancels the timeout on unmount', async () => {
    const { target, timeouts } = managedFixture();
    const errors: Error[] = [];
    const embed = orveltEmbed.configure({ projectId, onError: (error) => errors.push(error) });
    await embed.mount(target);
    const timeout = [...timeouts.values()][0];
    timeout();
    timeout();
    expect(errors.map((error) => error.message)).toEqual(['The opinion form could not be loaded.']);
    embed.unmount();
    expect(timeouts.size).toBe(0);
    timeout();
    expect(errors).toHaveLength(1);
  });

  it('cancels readiness failures after a trusted frame becomes ready', async () => {
    const { target, host, timeouts } = managedFixture();
    const errors: Error[] = [];
    let readyCount = 0;
    const embed = orveltEmbed.configure({
      projectId,
      onReady: () => readyCount++,
      onError: (error) => errors.push(error),
    });
    const frame = await embed.mount(target);
    const timeout = [...timeouts.values()][0];
    const message = new Event('message');
    Object.assign(message, {
      source: frame.contentWindow,
      origin: 'https://orvelt.com',
      data: { source: 'orvelt-opinion-embed', type: 'opinion-ready' },
    });
    host.dispatchEvent(message);
    expect(timeouts.size).toBe(0);
    expect(readyCount).toBe(1);
    timeout();
    expect(errors).toHaveLength(0);
    embed.unmount();
  });

  it('configures with just a project ID, without window/document or a session provider', () => {
    expect(() => orveltEmbed.configure({ projectId })).not.toThrow();
    expect(() => orveltEmbed.configure({ projectId, origin: 'javascript:alert(1)' })).toThrow(
      'HTTP(S)',
    );
    expect(() =>
      orveltEmbed.configure({ projectId, origin: 'https://user:pass@orvelt.com' }),
    ).toThrow();
  });
  it('defaults to the production origin when omitted', () => {
    expect(opinionEmbedUrl({ projectId })).toBe(
      `https://orvelt.com/embed/opinion/${projectId}?visibility=public`,
    );
  });
  it('mounts the iframe at the configured origin', async () => {
    const { target } = managedFixture();
    const embed = orveltEmbed.configure({ projectId, origin: 'http://localhost:3000' });
    expect((await embed.mount(target)).src).toBe(
      `http://localhost:3000/embed/opinion/${projectId}?visibility=public`,
    );
    embed.unmount();
  });
  it('mounts safe static attributes without fetching, shares mounts and remounts a fresh iframe', async () => {
    const { target, requests, frames } = managedFixture();
    const embed = orveltEmbed.configure({ projectId });
    const first = embed.mount(target);
    expect(embed.mount(target)).toBe(first);
    const frame = await first;
    expect(await embed.mount(target)).toBe(frame);
    expect(requests).toHaveLength(0);
    expect(frame).toMatchObject({
      title: 'Orvelt opinion form',
      allow: 'microphone',
      referrerPolicy: 'no-referrer',
      src: opinionEmbedUrl({ projectId }),
    });
    expect(frames[0].sandbox).toBe(
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
    );
    embed.unmount();
    expect(frame.isConnected).toBe(false);
    const next = await embed.mount(target);
    expect(next).not.toBe(frame);
    expect(frames).toHaveLength(2);
    expect(requests).toHaveLength(0);
    embed.unmount();
  });
  it('includes the optional reference as unverified frontend metadata', async () => {
    const { target, requests } = managedFixture();
    const embed = orveltEmbed.configure({
      projectId,
      externalUserId: 'reference/42 & more',
      visibility: 'private',
    });
    const frame = await embed.mount(target);
    expect(new URL(frame.src).searchParams.get('externalUserId')).toBe('reference/42 & more');
    expect(new URL(frame.src).searchParams.get('visibility')).toBe('private');
    expect(requests).toHaveLength(0);
    embed.unmount();
  });
  for (const attributes of [
    { orderId: 'order-42', nested: { tags: ['vip', null, 42, false] } },
    ['tag', { enabled: true }],
    'reference',
    0,
    false,
    null,
  ]) {
    it(`preserves JSON attributes in the fragment: ${JSON.stringify(attributes)}`, async () => {
      const { target } = managedFixture();
      const embed = orveltEmbed.configure({ projectId, attributes });
      const frame = await embed.mount(target);
      const url = new URL(frame.src);
      expect(url.searchParams.has('attributes')).toBe(false);
      expect(JSON.parse(new URLSearchParams(url.hash.slice(1)).get('attributes')!)).toEqual(
        attributes,
      );
      embed.unmount();
    });
  }
  for (const attributes of [
    BigInt(1),
    () => {},
    { nested: undefined },
    NaN,
    Infinity,
    new Date(),
  ]) {
    it(`rejects non-JSON attributes: ${String(attributes)}`, () => {
      expect(() => orveltEmbed.configure({ projectId, attributes: attributes as never })).toThrow();
    });
  }
  it('keeps the original session metadata when reopening', () => {
    expect(opinionEmbedUrl({ projectId, sessionUrl, attributes: { replacement: true } })).toBe(
      sessionUrl,
    );
  });
  it('reopens a supplied session URL instead of issuing a fresh installation URL', async () => {
    const { target, requests } = managedFixture();
    const embed = orveltEmbed.configure({ projectId, sessionUrl });
    expect((await embed.mount(target)).src).toBe(sessionUrl);
    expect(requests).toHaveLength(0);
    embed.unmount();
  });
  for (const url of [
    sessionUrl.replace(projectId, '019a0000-0000-7000-8000-000000000099'),
    sessionUrl.replace('orvelt.com', 'attacker.example'),
    sessionUrl.replace('/embed/opinion/', '/login/'),
    sessionUrl.replace('https://', 'https://user:password@'),
    `${sessionUrl}.${'a'.repeat(64)}`,
    `${sessionUrl}&token=${'a'.repeat(64)}`,
  ]) {
    it(`rejects an unsafe session URL: ${url.slice(0, 70)}`, () =>
      expect(() => orveltEmbed.configure({ projectId, sessionUrl: url })).toThrow());
  }
  it('reports a created session only from the trusted iframe, without author data', () => {
    const { frame, send } = fixture();
    const results: unknown[] = [];
    const detach = attachOpinionEmbed(frame as unknown as HTMLIFrameElement, {
      onSessionCreated: (url) => results.push(url),
    });
    const message = {
      source: 'orvelt-opinion-embed',
      type: 'opinion-session-created',
      url: sessionUrl,
      email: 'private@example.com',
    };
    send(message, 'https://attacker.example');
    send(message, 'https://orvelt.com', {});
    send({ ...message, url: sessionUrl.replace('orvelt.com', 'attacker.example') });
    send({ ...message, url: `${sessionUrl}.${'a'.repeat(64)}` });
    send({ ...message, url: `${sessionUrl}&token=${'a'.repeat(64)}` });
    expect(results).toEqual([]);
    send(message);
    expect(results).toEqual([sessionUrl]);
    detach();
    send(message);
    expect(results).toHaveLength(1);
  });
  it('rejects absent/disconnected targets', async () => {
    const { target } = managedFixture();
    const embed = orveltEmbed.configure({ projectId });
    await expect(embed.mount('#missing')).rejects.toThrow('connected');
    Object.assign(target, { isConnected: false });
    await expect(embed.mount(target)).rejects.toThrow('connected');
  });
  it('builds a standalone script without a DOM and preserves the global on repeated loading', async () => {
    const source = await buildOpinionEmbedScript();
    const context: { OrveltEmbed?: typeof orveltEmbed } = {};
    runInNewContext(source, context);
    expect(typeof context.OrveltEmbed?.configure).toBe('function');
    const original = context.OrveltEmbed;
    runInNewContext(source, context);
    expect(context.OrveltEmbed).toBe(original);
  });
});

describe('presentation options', () => {
  it('encodes appearance and the close button in the iframe URL', () => {
    const url = new URL(
      opinionEmbedUrl({
        projectId,
        appearance: { accentColor: '#4F6', colorScheme: 'system', radius: 0 },
        closeButton: true,
      }),
    );
    expect(url.searchParams.get('accent')).toBe('#44ff66');
    expect(url.searchParams.get('theme')).toBe('system');
    expect(url.searchParams.get('radius')).toBe('0');
    expect(url.searchParams.get('close')).toBe('button');
  });
  it('shows the close button for inline forms only when the host handles closing', () => {
    expect(new URL(opinionEmbedUrl({ projectId })).searchParams.has('close')).toBe(false);
    const onClose = Function.prototype as () => void;
    expect(new URL(opinionEmbedUrl({ projectId, onClose })).searchParams.get('close')).toBe(
      'button',
    );
    expect(
      new URL(opinionEmbedUrl({ projectId, onClose, closeButton: false })).searchParams.has(
        'close',
      ),
    ).toBe(false);
  });
  it('keeps appearance on reopened sessions', () => {
    const url = new URL(
      opinionEmbedUrl({ projectId, sessionUrl, appearance: { colorScheme: 'dark' } }),
    );
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.hash).toBe(new URL(sessionUrl).hash);
  });
  for (const appearance of [
    { accentColor: 'red' },
    { accentColor: '#12345' },
    { accentColor: '#fff;}body{' },
    { radius: 25 },
    { radius: 1.5 },
  ]) {
    it(`rejects invalid appearance ${JSON.stringify(appearance)}`, () =>
      expect(() => orveltEmbed.configure({ projectId, appearance })).toThrow());
  }
  it('forwards close requests only from the trusted iframe', () => {
    const { frame, send } = fixture();
    let closed = 0;
    const detach = attachOpinionEmbed(frame as unknown as HTMLIFrameElement, {
      onClose: () => closed++,
    });
    const message = { source: 'orvelt-opinion-embed', type: 'close-requested' };
    send(message, 'https://attacker.example');
    send(message, 'https://orvelt.com', {});
    expect(closed).toBe(0);
    send(message);
    expect(closed).toBe(1);
    detach();
  });
});

class FakeElement extends EventTarget {
  className = '';
  src = '';
  title = '';
  referrerPolicy = '';
  isConnected = false;
  open = false;
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  contentWindow = { postMessage: () => {} };
  constructor(
    readonly tag: string,
    readonly ownerDocument: object,
  ) {
    super();
  }
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }
  append(child: FakeElement) {
    child.isConnected = true;
  }
  remove() {
    this.isConnected = false;
  }
  showModal() {
    this.open = true;
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  }
}

function clickOn(target: FakeElement) {
  const event = new Event('click');
  Object.defineProperty(event, 'target', { value: target });
  return event;
}
const asFake = (frame: HTMLIFrameElement) => frame as unknown as FakeElement;

function modalFixture() {
  const host = new EventTarget();
  const sheets: string[] = [];
  const elements: FakeElement[] = [];
  const document = {
    defaultView: host,
    adoptedStyleSheets: [],
    body: new FakeElement('body', {}),
    createElement: (tag: string) => {
      const element = new FakeElement(tag, document);
      elements.push(element);
      return element;
    },
  };
  Object.assign(host, {
    setTimeout: () => 0,
    clearTimeout: () => {},
    location: { href: 'https://business.example/' },
    CSSStyleSheet: class {
      replaceSync(text: string) {
        sheets.push(text);
      }
    },
  });
  const send = (frame: FakeElement, data: unknown) => {
    const event = new Event('message');
    Object.assign(event, { data, origin: 'https://orvelt.com', source: frame.contentWindow });
    host.dispatchEvent(event);
  };
  const dialogs = () => elements.filter((element) => element.tag === 'dialog');
  return { document, sheets, send, dialogs };
}

async function withDocument(run: (fixture: ReturnType<typeof modalFixture>) => Promise<void>) {
  const modal = modalFixture();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: modal.document, configurable: true });
  try {
    await run(modal);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
}

describe('modal opinion embed', () => {
  it('opens a modal with a close button and closes on request, Escape, or backdrop', () =>
    withDocument(async ({ dialogs, sheets, send }) => {
      let closed = 0;
      const embed = orveltEmbed.configure({
        projectId,
        appearance: { colorScheme: 'dark' },
        onClose: () => closed++,
      });
      const frame = asFake(await embed.open());
      const [dialog] = dialogs();
      expect(dialog).toMatchObject({ className: 'orvelt-modal', open: true, isConnected: true });
      expect(dialog.attributes['aria-label']).toBe('Share your opinion');
      expect(dialog.style.colorScheme).toBe('dark');
      expect(frame.className).toBe('orvelt-modal__iframe');
      expect(new URL(frame.src).searchParams.get('close')).toBe('button');
      expect(sheets).toHaveLength(1);

      send(frame, { source: 'orvelt-opinion-embed', type: 'close-requested' });
      expect(dialog.open).toBe(false);
      expect(closed).toBe(1);

      // Reopening resumes the same, still-connected form.
      expect(asFake(await embed.open())).toBe(frame);
      expect(dialog.open).toBe(true);
      dialog.dispatchEvent(clickOn(frame));
      expect(dialog.open).toBe(true);
      dialog.dispatchEvent(clickOn(dialog));
      expect(dialog.open).toBe(false);
      expect(closed).toBe(2);
      embed.unmount();
      expect(dialog.isConnected).toBe(false);
      expect(frame.isConnected).toBe(false);
      expect(closed).toBe(2);
    }));

  it('starts a fresh form after a submitted modal closes', () =>
    withDocument(async ({ dialogs, send }) => {
      const embed = orveltEmbed.configure({ projectId });
      const frame = asFake(await embed.open());
      send(frame, { source: 'orvelt-opinion-embed', type: 'opinion-submitted', isPrivate: false });
      embed.close();
      expect(frame.isConnected).toBe(false);
      expect(asFake(await embed.open())).not.toBe(frame);
      expect(dialogs()).toHaveLength(2);
      embed.unmount();
    }));

  it('replaces an open modal when mounted inline, without a close button by default', () =>
    withDocument(async ({ document, dialogs }) => {
      const embed = orveltEmbed.configure({ projectId });
      await embed.open();
      const slot = document.createElement('div');
      slot.isConnected = true;
      const frame = await embed.mount(slot as unknown as HTMLElement);
      expect(dialogs()[0].isConnected).toBe(false);
      expect(frame.className).toBe('orvelt-iframe');
      expect(new URL(frame.src).searchParams.has('close')).toBe(false);
      embed.unmount();
    }));

  it('rejects opening without a browser document', async () => {
    await expect(orveltEmbed.configure({ projectId }).open()).rejects.toThrow('browser page');
  });
});
