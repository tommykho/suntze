/**
 * Stateless BYOK CORS relay: core logic (portable, Web Fetch API only).
 *
 * Purpose: some AI providers do not allow browser CORS, so the static site
 * POSTs to /api/relay with the target URL in `x-relay-target` and this module
 * forwards the request upstream and streams the answer back.
 *
 * Security model:
 *   - Origin: only the site's own origin, ALLOWED_ORIGINS (exact match) and,
 *     when DEV=1, http://localhost / http://127.0.0.1. Missing Origin = 403.
 *   - Target: https only, no credentials, no explicit port, no ".." after
 *     decoding, and origin+pathname must start with an ALLOWLIST prefix.
 *     This stops the relay being an open proxy.
 *   - Only FORWARD_HEADERS are sent upstream (no cookies). Set-Cookie is never
 *     returned. Bodies are capped at 100 KB. Upstream redirects are not followed.
 *   - Keys are never stored or logged: no storage, no console output, and
 *     error responses never echo the request.
 *
 * Cost: runs on Cloudflare Pages Functions free tier (100k requests/day), so
 * the site owner pays $0. Requests beyond the free quota simply fail.
 */

export const ALLOWLIST = [
  'https://integrate.api.nvidia.com/v1/',
  'https://api.meta.ai/v1/',
  'https://api.groq.com/openai/v1/',
  'https://api.mistral.ai/v1/',
  'https://api.cerebras.ai/v1/',
  'https://models.github.ai/inference/',
  'https://openrouter.ai/api/v1/',
  'https://generativelanguage.googleapis.com/v1beta/',
  'https://api.openai.com/v1/',
  'https://api.elevenlabs.io/v1/',
];

export const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'xi-api-key',
  'x-goog-api-key',
  'http-referer',
  'x-title',
];

const TARGET_HEADER = 'x-relay-target';
const MAX_BODY_BYTES = 100 * 1024;
const UPSTREAM_TIMEOUT_MS = 90_000;
const ALLOW_HEADERS = [...FORWARD_HEADERS, TARGET_HEADER].join(', ');
const ALLOW_METHODS = 'POST, OPTIONS';
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

function parseList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Returns the request Origin if it is allowed, otherwise null. */
function allowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  if (env.DEV === '1' && LOCAL_ORIGIN.test(origin)) return origin;
  if (parseList(env.ALLOWED_ORIGINS).includes(origin)) return origin;

  try {
    if (new URL(request.url).origin === origin) return origin;
  } catch {
    // Unparseable request URL: fall through to deny.
  }
  return null;
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': ALLOW_HEADERS,
    'access-control-allow-methods': ALLOW_METHODS,
    'access-control-max-age': '600',
  };
}

function jsonError(status, message, cors, extra) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    vary: 'Origin',
    ...(extra || {}),
  });
  if (cors) for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

/**
 * Validates the x-relay-target value. Returns { url } or { status, message }.
 * Checks run on the raw string as well as the parsed URL, because the WHATWG
 * URL parser silently resolves "/../" segments and would hide traversal.
 */
function checkTarget(raw) {
  if (!raw) return { status: 400, message: 'missing target' };
  const value = raw.trim();

  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return { status: 400, message: 'invalid target' };
  }
  if (decoded.includes('..')) return { status: 400, message: 'path traversal rejected' };

  let url;
  try {
    url = new URL(value);
  } catch {
    return { status: 400, message: 'invalid target' };
  }
  if (url.protocol !== 'https:') return { status: 400, message: 'target must use https' };
  if (url.username || url.password) return { status: 400, message: 'credentials not allowed' };

  // Raw authority check: catches explicit ports such as :443, which the URL
  // parser normalises away, and any userinfo.
  const authority = /^https:[\\/]{2}([^\\/?#]*)/i.exec(value);
  if (!authority || authority[1].includes(':') || authority[1].includes('@')) {
    return { status: 400, message: 'explicit port or credentials not allowed' };
  }
  if (url.port !== '') return { status: 400, message: 'explicit port not allowed' };

  const prefix = url.origin + url.pathname;
  if (!ALLOWLIST.some((p) => prefix.startsWith(p))) {
    return { status: 403, message: 'target not allowed' };
  }
  return { url };
}

/**
 * Reads the request body, enforcing MAX_BODY_BYTES while streaming so an
 * oversized body is never fully buffered. Returns { bytes } or { tooLarge }
 * or { invalid }.
 */
async function readBody(request) {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const n = Number(declared);
    if (!Number.isFinite(n) || n < 0) return { invalid: true };
    if (n > MAX_BODY_BYTES) return { tooLarge: true };
  }
  if (!request.body) return { bytes: new ArrayBuffer(0) };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // Ignore cancel failures; we are rejecting anyway.
      }
      return { tooLarge: true };
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes: out.buffer };
}

/**
 * Handles one relay request.
 * @param {Request} request
 * @param {Record<string, string>} [env] ALLOWED_ORIGINS and DEV bindings.
 * @returns {Promise<Response>}
 */
export async function handleRelay(request, env = {}) {
  const origin = allowedOrigin(request, env || {});
  const cors = origin ? corsHeaders(origin) : null;

  if (request.method !== 'POST' && request.method !== 'OPTIONS') {
    return jsonError(405, 'method not allowed', cors, { allow: ALLOW_METHODS });
  }
  if (!origin) return jsonError(403, 'origin not allowed', null);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: new Headers({ ...cors, vary: 'Origin' }),
    });
  }

  const check = checkTarget(request.headers.get(TARGET_HEADER));
  if (!check.url) return jsonError(check.status, check.message, cors);
  const target = check.url;

  const body = await readBody(request);
  if (body.tooLarge) return jsonError(413, 'body too large', cors);
  if (body.invalid) return jsonError(400, 'invalid content-length', cors);

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetch(target.href, {
      method: 'POST',
      headers,
      body: body.bytes,
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch {
    return controller.signal.aborted
      ? jsonError(504, 'upstream timeout', cors)
      : jsonError(502, 'upstream unreachable', cors);
  } finally {
    clearTimeout(timer);
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    try {
      await upstream.body?.cancel();
    } catch {
      // Ignore.
    }
    return jsonError(502, 'upstream redirect not followed', cors);
  }

  const out = new Headers({ ...cors, vary: 'Origin', 'cache-control': 'no-store' });
  const contentType = upstream.headers.get('content-type');
  if (contentType) out.set('content-type', contentType);
  const retryAfter = upstream.headers.get('retry-after');
  if (retryAfter) out.set('retry-after', retryAfter);
  upstream.headers.forEach((value, name) => {
    if (name.startsWith('x-ratelimit-')) out.set(name, value);
  });

  // Stream the upstream body through without buffering.
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
