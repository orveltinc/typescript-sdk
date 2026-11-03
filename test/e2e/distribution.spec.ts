import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { createOpinionEmbed } from '../../src/browser.js';
import { browserBundle, consumerDirectory, installedPackage } from '../support/prepare-package';

declare global {
  var sdkTestEmbed: ReturnType<typeof createOpinionEmbed>;
}

const run = promisify(execFile);
const projectId = '123e4567-e89b-42d3-a456-426614174000';
const hostOrigin = 'http://localhost:54810';
const storefrontOrigin = 'http://127.0.0.1:54812';
const localScript = 'http://127.0.0.1:54810/opinion-embed.js';

// Only the iframe protocol is a fixture here. The existing cross-product suite covers real submission.
async function exerciseBundle(page: Page, script: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(`${storefrontOrigin}/embed/opinion/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body>
        <button id="submit">Submit fixture opinion</button>
        <button id="close">Close fixture</button>
        <script>
          const send = (data) => parent.postMessage(
            { source: 'orvelt-opinion-embed', ...data }, '${hostOrigin}');
          addEventListener('message', (event) => {
            if (event.origin === '${hostOrigin}' && event.data.type === 'start-opinion')
              send({ type: 'resize', height: 420 });
          });
          document.querySelector('#submit').onclick = () =>
            send({ type: 'opinion-submitted', isPrivate: true });
          document.querySelector('#close').onclick = () => send({ type: 'close-requested' });
          send({ type: 'opinion-ready' });
        </script>
      </body></html>`,
    }),
  );
  await page.goto(hostOrigin);
  await page.addScriptTag({ url: script });
  expect(
    await page.evaluate(async (url) => {
      const original = globalThis.OrveltEmbed;
      if (!original) throw new Error('The script did not expose OrveltEmbed.');
      await new Promise<void>((resolve, reject) => {
        const repeated = document.createElement('script');
        repeated.src = url;
        repeated.addEventListener('load', () => resolve(), { once: true });
        repeated.addEventListener(
          'error',
          () => reject(new Error('Repeated script loading failed.')),
          { once: true },
        );
        document.body.append(repeated);
      });
      return globalThis.OrveltEmbed === original;
    }, script),
  ).toBe(true);
  await page.evaluate(
    async ({ id, origin }) => {
      if (!globalThis.OrveltEmbed) throw new Error('The script did not expose OrveltEmbed.');
      globalThis.sdkTestEmbed = globalThis.OrveltEmbed.configure({
        projectId: id,
        origin,
        visibility: 'private',
        externalUserId: 'distribution-check',
        onReady: () => {
          document.body.dataset.ready = 'true';
        },
        onSubmitted: ({ isPrivate }) => {
          document.body.dataset.submitted = String(isPrivate);
        },
        onClose: () => {
          document.body.dataset.closed = 'true';
        },
      });
      await globalThis.sdkTestEmbed.mount('#slot');
    },
    { id: projectId, origin: storefrontOrigin },
  );
  const iframe = page.locator('#slot iframe');
  await expect(iframe).toHaveCount(1);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(iframe).toHaveCSS('height', '420px');
  const source = await iframe.getAttribute('src');
  if (!source) throw new Error('The iframe has no source URL.');
  const url = new URL(source);
  expect(url.origin).toBe(storefrontOrigin);
  expect(url.pathname).toBe(`/embed/opinion/${projectId}`);
  expect(url.searchParams.get('visibility')).toBe('private');
  expect(url.searchParams.get('externalUserId')).toBe('distribution-check');
  await page
    .frameLocator('#slot iframe')
    .getByRole('button', { name: 'Submit fixture opinion' })
    .click();
  await expect(page.locator('body')).toHaveAttribute('data-submitted', 'true');
  await page.evaluate(() => globalThis.sdkTestEmbed.unmount());
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.evaluate(() => globalThis.sdkTestEmbed.open().then(() => undefined));
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .frameLocator('dialog iframe')
    .getByRole('button', { name: 'Close fixture', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-closed', 'true');
  await page.evaluate(() => globalThis.sdkTestEmbed.unmount());
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(errors).toEqual([]);
}

// Risk: the shipped modal wastes a page of space before hydration or clips actions on short screens.
// Boundary: the packed browser SDK, real dialog layout, and cross-origin resize protocol.
test('the modal stays compact before readiness and scrolls tall content within the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route(`${storefrontOrigin}/embed/opinion/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body style="margin:0">
        <button id="grow">Show more questions</button>
        <div id="questions"></div>
        <button id="continue">Continue</button>
        <script>
          const sendHeight = (height) => parent.postMessage(
            { source: 'orvelt-opinion-embed', type: 'resize', height }, '${hostOrigin}');
          document.querySelector('#grow').onclick = () => {
            document.querySelector('#questions').style.height = '1500px';
            sendHeight(1600);
          };
          document.querySelector('#continue').onclick = () => {
            document.querySelector('#questions').style.height = '0px';
            sendHeight(240);
          };
        </script>
      </body></html>`,
    }),
  );
  await page.goto(hostOrigin);
  // Reproduce host resets without overriding the SDK's deliberately customizable selectors.
  await page.addStyleTag({ content: '* { margin: 0; padding: 0; box-sizing: border-box; }' });
  await page.addScriptTag({ url: localScript });
  await page.evaluate(
    async ({ id, origin }) => {
      if (!globalThis.OrveltEmbed) throw new Error('The script did not expose OrveltEmbed.');
      globalThis.sdkTestEmbed = globalThis.OrveltEmbed.configure({
        projectId: id,
        origin,
        deferStart: true,
      });
      await globalThis.sdkTestEmbed.open();
    },
    { id: projectId, origin: storefrontOrigin },
  );
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const measure = () =>
    dialog.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
  expect((await measure()).height).toBeLessThanOrEqual(400);
  const frame = page.frameLocator('dialog iframe');
  await frame.getByRole('button', { name: 'Show more questions' }).click();
  await expect.poll(async () => (await measure()).height).toBe(640);
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await measure();
    expect(bounds.y).toBeGreaterThanOrEqual(16);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 16);
    expect(bounds.x).toBeGreaterThanOrEqual(16);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 16);
    // Playwright must scroll inside the real iframe to reach the bottom action.
    await frame.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect.poll(async () => (await measure()).height).toBe(240);
    await frame.getByRole('button', { name: 'Show more questions' }).click();
  }
  await page.evaluate(() => globalThis.sdkTestEmbed.close());
  await expect(dialog).not.toBeVisible();
});

test('the installed release includes resolvable agent skills with their original contents', async () => {
  const skills = await Promise.all(
    ['orvelt-business-sdk', 'orvelt-opinion-embeds'].map(async (name) => ({
      name,
      content: await readFile(new URL(`../../skills/${name}/SKILL.md`, import.meta.url), 'utf8'),
    })),
  );
  await run(
    'node',
    [
      '--input-type=module',
      '--eval',
      `
    import assert from 'node:assert/strict';
    import { readFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    const skills = ${JSON.stringify(skills)};
    const readme = await readFile(
      new URL('./README.md', import.meta.resolve('@orvelt/business/package.json')), 'utf8');
    for (const { name, content } of skills) {
      const url = import.meta.resolve('@orvelt/business/skills/' + name + '/SKILL.md');
      assert.ok(fileURLToPath(url).startsWith(${JSON.stringify(installedPackage)}));
      assert.equal(await readFile(new URL(url), 'utf8'), content);
      assert.ok(readme.includes('(skills/' + name + '/SKILL.md)'));
    }
  `,
    ],
    { cwd: consumerDirectory, timeout: 30_000 },
  );
});

test('the packed npm entries import in Node without a DOM or workspace dependencies', async () => {
  await run(
    'node',
    [
      '--input-type=module',
      '--eval',
      `
    import assert from 'node:assert/strict';
    import * as sdk from '@orvelt/business';
    import * as browser from '@orvelt/business/browser';
    assert.equal(typeof document, 'undefined');
    assert.equal(typeof sdk.businessClient, 'object');
    for (const entry of [sdk, browser]) {
      const embed = entry.orveltEmbed.configure({ projectId: '${projectId}' });
      for (const method of ['mount', 'open', 'close', 'start', 'unmount'])
        assert.equal(typeof embed[method], 'function');
    }
  `,
    ],
    { cwd: consumerDirectory, timeout: 30_000 },
  );
});

// Risk: a published tarball can import successfully while its first real request
// loses authentication or changes the generated error contract in a runtime.
// Boundary: the installed package's public client, real fetch, and a local HTTP server.
test('the installed package performs authenticated requests and preserves HTTP errors in Node and Bun', async () => {
  const source = await readFile(
    new URL('../support/consumer-runtime.mjs', import.meta.url),
    'utf8',
  );

  for (const runtime of ['node', 'bun']) {
    await run(runtime, ['--input-type=module', '--eval', source], {
      cwd: consumerDirectory,
      timeout: 30_000,
    });
  }
});

test('the packed browser script supports script tags, iframe callbacks, cleanup and modals', async ({
  page,
  request,
}) => {
  const metadata = JSON.parse(await readFile(join(installedPackage, 'package.json'), 'utf8'));
  expect(metadata.license).toBe('Apache-2.0');
  expect(await readFile(join(installedPackage, 'LICENSE'), 'utf8')).toContain(
    'Apache License\n                           Version 2.0',
  );
  expect(metadata.unpkg).toBe('./dist/opinion-embed.js');
  expect(metadata.jsdelivr).toBe(metadata.unpkg);
  const response = await request.get(localScript);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('javascript');
  expect(await response.text()).toBe(await readFile(browserBundle, 'utf8'));
  const loaded: number[] = [];
  page.on('response', (result) => {
    if (result.url() === localScript) loaded.push(result.status());
  });
  await exerciseBundle(page, localScript);
  expect(loaded).toEqual([200, 200]);
});
