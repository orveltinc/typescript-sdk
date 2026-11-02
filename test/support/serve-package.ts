import { browserBundle } from './prepare-package';

// A dedicated test-only distribution endpoint, independent of the storefront and UNPKG.
Bun.serve({
  hostname: '127.0.0.1',
  port: 54810,
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return new Response('ok');
    if (pathname === '/') {
      return new Response('<!doctype html><html><body><div id="slot"></div></body></html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    if (pathname === '/opinion-embed.js') {
      return new Response(Bun.file(browserBundle), {
        headers: {
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }
    return new Response('Not found', { status: 404 });
  },
});
