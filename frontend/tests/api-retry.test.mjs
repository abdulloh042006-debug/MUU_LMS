import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/api-service.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(`${source}\nexport { fetchAPI };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function client(failure) {
  let calls = 0;
  const context = {
    exports: {}, Headers, FormData, AbortSignal,
    require: () => ({ config: { API_BASE_URL: '/api', API_TIMEOUT: 1000 } }),
    setTimeout: (callback) => callback(),
    fetch: async () => {
      calls++;
      if (failure === 'network') throw new TypeError('Network failure');
      return new Response('{}', { status: failure });
    },
  };
  vm.runInNewContext(compiled, context);
  return { request: context.exports.fetchAPI, calls: () => calls };
}

for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']) {
  for (const failure of [500, 503, 'network']) {
    test(`${method}: bounded replay for ${failure}`, async () => {
      const api = client(failure);
      await assert.rejects(api.request('/attendance/check-in/', { method }));
      const canRetry = failure === 'network' ? method === 'GET' : ['GET', 'HEAD'].includes(method);
      assert.equal(api.calls(), canRetry ? 2 : 1);
    });
  }
}

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  test(`${method}: no replay or refresh after 401`, async () => {
    const api = client(401);
    await assert.rejects(api.request('/attendance/check-in/', { method }));
    assert.equal(api.calls(), 1);
  });
}

test('default method is GET and retries once', async () => {
  const api = client(500);
  await assert.rejects(api.request('/attendance/active/'));
  assert.equal(api.calls(), 2);
});
