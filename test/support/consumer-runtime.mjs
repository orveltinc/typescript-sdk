import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { orvelt, subscribers } from '@orvelt/business';

const projectId = '123e4567-e89b-42d3-a456-426614174000';
let mode = 'success';

const server = createServer((request, response) => {
  assert.equal(request.headers['x-api-key'], 'consumer-test-key');
  assert.equal(request.url, `/project/${projectId}/subscribers/count`);
  response.setHeader('content-type', 'application/json');

  if (mode === 'error') {
    response.statusCode = 401;
    response.end(
      JSON.stringify({
        defined: true,
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Authentication is required.',
      }),
    );
    return;
  }

  response.end(JSON.stringify({ total: 12, delta: 3 }));
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');

try {
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  orvelt({ apiKey: 'consumer-test-key', baseUrl: `http://127.0.0.1:${address.port}` });

  const success = await subscribers.count({ projectId });
  assert.equal(success.error, undefined);
  assert.deepEqual(success.data, { total: 12, delta: 3 });

  mode = 'error';
  const failed = await subscribers.count({ projectId });
  assert.equal(failed.data, undefined);
  assert.equal(failed.error.code, 'UNAUTHORIZED');
  assert.equal(failed.response.status, 401);
  await assert.rejects(
    subscribers.count({ projectId }, { throwOnError: true }),
    (error) => error?.code === 'UNAUTHORIZED' && error?.status === 401,
  );
} finally {
  server.close();
}
