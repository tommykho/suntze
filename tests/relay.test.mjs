import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleRelay, ALLOWLIST, FORWARD_HEADERS } from '../server/relay-core.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const SITE = 'https://relay.example.com';
const OPENAI = 'https://api.openai.com/v1/chat/completions';
const BODY = '{"model":"gpt-x","messages":[]}';

/** Replaces globalThis.fetch and records every call. */
function mockFetch(impl) {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return impl(String(input), init);
  };
  return calls;
}

function okUpstream() {
  return new Response('{"ok":true}', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeRequest({
  origin = 'https://app.example.com',
  target = OPENAI,
  method = 'POST',
  body = BODY,
  headers = {},
  url = `${SITE}/api/relay`,
} = {}) {
  const h = new Headers(headers);
  if (origin !== null) h.set('origin', origin);
  if (target !== null) h.set('x-relay-target', target);
  const init = { method, headers: h };
  if (method !== 'GET' && method !== 'OPTIONS' && body !== null) init.body = body;
  return new Request(url, init);
}

const ALLOWED_ENV = { ALLOWED_ORIGINS: 'https://app.example.com' };

test('allowed target is relayed with the right URL, method, headers and body', async () => {
  const calls = mockFetch(okUpstream);
  const req = makeRequest({
    headers: {
      authorization: 'Bearer sk-test-123',
      'content-type': 'application/json',
      accept: 'application/json',
      cookie: 'session=secret',
      'x-custom': 'nope',
      'xi-api-key': 'should-not-forward-here-but-is-allowed',
    },
  });

  const res = await handleRelay(req, ALLOWED_ENV);

  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, OPENAI);
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'manual');
  assert.ok(init.signal instanceof AbortSignal);

  const sent = new Headers(init.headers);
  assert.deepEqual(
    [...sent.keys()].sort(),
    ['accept', 'authorization', 'content-type', 'xi-api-key'],
  );
  assert.equal(sent.get('authorization'), 'Bearer sk-test-123');
  assert.equal(sent.get('cookie'), null);
  assert.equal(sent.get('x-custom'), null);
  assert.equal(sent.get('origin'), null);

  assert.equal(new TextDecoder().decode(init.body), BODY);
  assert.equal(await res.text(), '{"ok":true}');
});

test('every allowlist prefix is accepted', async () => {
  for (const prefix of ALLOWLIST) {
    const calls = mockFetch(okUpstream);
    const res = await handleRelay(makeRequest({ target: `${prefix}resource` }), ALLOWED_ENV);
    assert.equal(res.status, 200, `prefix ${prefix} should be allowed`);
    assert.equal(calls[0].url, `${prefix}resource`);
  }
});

test('query string on an allowed target is kept', async () => {
  const calls = mockFetch(okUpstream);
  const res = await handleRelay(makeRequest({ target: `${OPENAI}?api-version=2` }), ALLOWED_ENV);
  assert.equal(res.status, 200);
  assert.equal(calls[0].url, `${OPENAI}?api-version=2`);
});

test('disallowed hosts and paths return 403 without fetching', async () => {
  const calls = mockFetch(okUpstream);
  const targets = [
    'https://evil.example.com/v1/chat',
    'https://api.openai.com.evil.example.com/v1/chat',
    'https://api.openai.com/v2/chat',
    'https://api.openai.com/v1',
  ];
  for (const target of targets) {
    const res = await handleRelay(makeRequest({ target }), ALLOWED_ENV);
    assert.equal(res.status, 403, target);
    assert.deepEqual(await res.json(), { error: 'target not allowed' });
  }
  assert.equal(calls.length, 0);
});

test('http (not https) target is rejected with 400', async () => {
  const calls = mockFetch(okUpstream);
  const res = await handleRelay(
    makeRequest({ target: 'http://api.openai.com/v1/chat/completions' }),
    ALLOWED_ENV,
  );
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('path traversal returns 400 (raw, encoded and normalised forms)', async () => {
  const calls = mockFetch(okUpstream);
  const targets = [
    'https://api.openai.com/v1/../v2/x',
    'https://api.openai.com/v1/%2e%2e/x',
    'https://api.openai.com/v1/..%2Fsecret',
  ];
  for (const target of targets) {
    const res = await handleRelay(makeRequest({ target }), ALLOWED_ENV);
    assert.equal(res.status, 400, target);
  }
  assert.equal(calls.length, 0);
});

test('credentials, explicit ports and malformed targets return 400', async () => {
  const calls = mockFetch(okUpstream);
  const targets = [
    'https://user:pass@api.openai.com/v1/x',
    'https://user@api.openai.com/v1/x',
    'https://api.openai.com:8443/v1/x',
    'https://api.openai.com:443/v1/x',
    'not a url',
  ];
  for (const target of targets) {
    const res = await handleRelay(makeRequest({ target }), ALLOWED_ENV);
    assert.equal(res.status, 400, target);
  }
  assert.equal(calls.length, 0);
});

test('missing x-relay-target returns 400', async () => {
  const res = await handleRelay(makeRequest({ target: null }), ALLOWED_ENV);
  assert.equal(res.status, 400);
});

test('missing Origin returns 403 with no CORS headers', async () => {
  const calls = mockFetch(okUpstream);
  const res = await handleRelay(makeRequest({ origin: null }), ALLOWED_ENV);
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'origin not allowed' });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal(calls.length, 0);
});

test('wrong Origin returns 403', async () => {
  const calls = mockFetch(okUpstream);
  const res = await handleRelay(makeRequest({ origin: 'https://attacker.example' }), ALLOWED_ENV);
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal(calls.length, 0);
});

test('same-origin request is allowed without ALLOWED_ORIGINS', async () => {
  mockFetch(okUpstream);
  const res = await handleRelay(makeRequest({ origin: SITE }), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), SITE);
  assert.equal(res.headers.get('vary'), 'Origin');
});

test('ALLOWED_ORIGINS works with comma separation, trimming and exact match', async () => {
  mockFetch(okUpstream);
  const env = { ALLOWED_ORIGINS: ' https://a.example.com , https://b.example.com ' };

  const ok = await handleRelay(makeRequest({ origin: 'https://b.example.com' }), env);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://b.example.com');

  const prefixMatch = await handleRelay(
    makeRequest({ origin: 'https://a.example.com.evil.com' }),
    env,
  );
  assert.equal(prefixMatch.status, 403);

  const notListed = await handleRelay(makeRequest({ origin: 'https://c.example.com' }), env);
  assert.equal(notListed.status, 403);
});

test('localhost origins are allowed only when DEV=1', async () => {
  mockFetch(okUpstream);

  const withoutDev = await handleRelay(makeRequest({ origin: 'http://localhost:5173' }), {});
  assert.equal(withoutDev.status, 403);

  const devZero = await handleRelay(
    makeRequest({ origin: 'http://localhost:5173' }),
    { DEV: '0' },
  );
  assert.equal(devZero.status, 403);

  const devLocalhost = await handleRelay(
    makeRequest({ origin: 'http://localhost:5173' }),
    { DEV: '1' },
  );
  assert.equal(devLocalhost.status, 200);
  assert.equal(devLocalhost.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const devLoopback = await handleRelay(
    makeRequest({ origin: 'http://127.0.0.1:8080' }),
    { DEV: '1' },
  );
  assert.equal(devLoopback.status, 200);

  const spoofed = await handleRelay(
    makeRequest({ origin: 'http://localhost.evil.example' }),
    { DEV: '1' },
  );
  assert.equal(spoofed.status, 403);
});

test('oversize body (streamed, over 100 KB) returns 413 and does not fetch', async () => {
  const calls = mockFetch(okUpstream);
  const big = 'x'.repeat(100 * 1024 + 1);
  const res = await handleRelay(makeRequest({ body: big }), ALLOWED_ENV);
  assert.equal(res.status, 413);
  assert.deepEqual(await res.json(), { error: 'body too large' });
  assert.equal(calls.length, 0);
});

test('body of exactly 100 KB is accepted', async () => {
  const calls = mockFetch(okUpstream);
  const exact = 'x'.repeat(100 * 1024);
  const res = await handleRelay(makeRequest({ body: exact }), ALLOWED_ENV);
  assert.equal(res.status, 200);
  assert.equal(calls[0].init.body.byteLength, 100 * 1024);
});

test('declared content-length over the limit returns 413 before reading', async () => {
  const calls = mockFetch(okUpstream);
  const req = makeRequest({
    body: null,
    headers: { 'content-length': String(200 * 1024) },
  });
  const res = await handleRelay(req, ALLOWED_ENV);
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
});

test('OPTIONS preflight from an allowed origin returns 204 with CORS headers', async () => {
  const calls = mockFetch(okUpstream);
  const res = await handleRelay(makeRequest({ method: 'OPTIONS', body: null }), ALLOWED_ENV);
  assert.equal(res.status, 204);
  assert.equal(res.body, null);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://app.example.com');
  assert.equal(res.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assert.equal(res.headers.get('access-control-max-age'), '600');
  const allowHeaders = res.headers.get('access-control-allow-headers').split(', ');
  for (const name of [...FORWARD_HEADERS, 'x-relay-target']) {
    assert.ok(allowHeaders.includes(name), `allow-headers should include ${name}`);
  }
  assert.equal(calls.length, 0);
});

test('OPTIONS preflight from a disallowed origin gets no CORS headers', async () => {
  const res = await handleRelay(
    makeRequest({ method: 'OPTIONS', body: null, origin: 'https://attacker.example' }),
    ALLOWED_ENV,
  );
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('other methods return 405 JSON', async () => {
  mockFetch(okUpstream);
  const res = await handleRelay(makeRequest({ method: 'GET', body: null }), ALLOWED_ENV);
  assert.equal(res.status, 405);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await res.json(), { error: 'method not allowed' });
});

test('upstream status, content-type and retry-after pass through; set-cookie is stripped', async () => {
  mockFetch(
    () =>
      new Response('{"error":"rate limited"}', {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': '7',
          'x-ratelimit-remaining': '0',
          'set-cookie': 'sid=abc; HttpOnly',
          server: 'upstream-internal',
        },
      }),
  );
  const res = await handleRelay(makeRequest(), ALLOWED_ENV);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('retry-after'), '7');
  assert.equal(res.headers.get('x-ratelimit-remaining'), '0');
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal(res.headers.get('server'), null);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('content-length'), null);
  assert.equal(await res.text(), '{"error":"rate limited"}');
});

test('streaming upstream content-type is passed through', async () => {
  mockFetch(
    () =>
      new Response('data: hi\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
  );
  const res = await handleRelay(makeRequest(), ALLOWED_ENV);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  assert.equal(await res.text(), 'data: hi\n\n');
});

test('upstream redirect is not followed and returns 502', async () => {
  mockFetch(
    () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.example.com/steal' },
      }),
  );
  const res = await handleRelay(makeRequest(), ALLOWED_ENV);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'upstream redirect not followed' });
});

test('upstream network error returns 502 JSON', async () => {
  mockFetch(() => {
    throw new TypeError('fetch failed');
  });
  const res = await handleRelay(makeRequest(), ALLOWED_ENV);
  assert.equal(res.status, 502);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await res.json(), { error: 'upstream unreachable' });
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://app.example.com');
});

test('upstream timeout after 90 s returns 504 JSON', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fetchStarted;
  const started = new Promise((resolve) => {
    fetchStarted = resolve;
  });
  mockFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        fetchStarted();
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
  );

  const pending = handleRelay(makeRequest(), ALLOWED_ENV);
  await started;
  t.mock.timers.tick(90_000);
  const res = await pending;
  assert.equal(res.status, 504);
  assert.deepEqual(await res.json(), { error: 'upstream timeout' });
});
