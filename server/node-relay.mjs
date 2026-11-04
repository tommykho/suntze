/**
 * Optional Node 18+ adapter for self-hosting the relay (for example on a NAS
 * behind Cloudflare Tunnel). Serves POST/OPTIONS /api/relay on PORT (default
 * 8787) and 404s everything else. All logic lives in relay-core.js.
 *
 * Environment: PORT, ALLOWED_ORIGINS (comma-separated), DEV ('1' enables
 * localhost origins). Headers and bodies are never logged.
 */
import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { handleRelay } from './relay-core.js';

const PORT = Number(process.env.PORT) || 8787;
const ROUTE = '/api/relay';

function toWebRequest(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v);
    } else {
      headers.set(name, value);
    }
  }

  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    url = new URL('http://localhost/');
  }

  const init = { method: req.method, headers };
  if (req.method === 'POST') {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }
  return new Request(url, init);
}

async function sendWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  res.writeHead(response.status, headers);
  if (response.body) {
    await pipeline(Readable.fromWeb(response.body), res);
  } else {
    res.end();
  }
}

function sendJson(res, status, message) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify({ error: message }));
}

const server = http.createServer(async (req, res) => {
  let path;
  try {
    path = new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    path = '';
  }

  if (path !== ROUTE || (req.method !== 'POST' && req.method !== 'OPTIONS')) {
    req.resume();
    sendJson(res, 404, 'not found');
    return;
  }

  try {
    const response = await handleRelay(toWebRequest(req), process.env);
    await sendWebResponse(res, response);
  } catch {
    if (!res.headersSent) sendJson(res, 500, 'internal error');
    else res.destroy();
  }
});

server.listen(PORT);
