import { RELAY_URL } from '../../lib/url.js';
// Bring-your-own-key LLM providers. Every call goes from the visitor's browser to the provider
// with the visitor's own key (or no key). The site owner pays nothing. Providers that block browser
// CORS go through /api/relay — a stateless pass-through that never stores keys.

export const PROVIDERS = [
  // ---- no key ----
  {
    id: 'puter', label: 'Puter.js — no key', group: 'No key needed', kind: 'puter', needsKey: false,
    model: '', models: ['gpt-5-nano', 'claude-sonnet-4-5', 'gemini-2.5-flash'],
    note: 'Opens a free Puter sign-in once. Puter covers usage under its "user pays" model, so this site pays nothing. Third-party service; leave the model blank for Puter\'s default.',
    keyUrl: 'https://docs.puter.com/AI/chat/',
  },
  {
    id: 'webllm', label: 'On-device (WebLLM)', group: 'No key needed', kind: 'webllm', needsKey: false,
    model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    models: ['Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Qwen2.5-3B-Instruct-q4f16_1-MLC', 'Phi-3.5-mini-instruct-q4f16_1-MLC', 'Llama-3.2-1B-Instruct-q4f16_1-MLC'],
    note: 'Runs fully in your browser (needs WebGPU: recent Chrome/Edge). First run downloads about 2 GB and is cached. Private, but answers are simpler.',
    keyUrl: 'https://webllm.mlc.ai/',
  },
  // ---- free keys ----
  {
    id: 'openrouter', label: 'OpenRouter', group: 'Free key', kind: 'openai', needsKey: true,
    base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3.1:free', 'qwen/qwen3-235b-a22b:free', 'google/gemma-3-27b-it:free'],
    listFree: true,
    note: 'Free models end in ":free" (roughly 50 requests a day). Free model names change often — press "Load free models" to pick a current one.',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'gemini', label: 'Google Gemini', group: 'Free key', kind: 'openai', needsKey: true,
    base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest',
    models: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'],
    note: 'Generous free tier from Google AI Studio. On the free tier Google may use prompts to improve its products, so leave out names and private details. The same key can voice the podcast.',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'groq', label: 'Groq', group: 'Free key', kind: 'openai', needsKey: true,
    base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'],
    note: 'Very fast free tier with daily limits.', keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'nvidia', label: 'NVIDIA NIM', group: 'Free key', kind: 'openai', needsKey: true, relay: true,
    base: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-r1', 'nvidia/llama-3.3-nemotron-super-49b-v1', 'qwen/qwen2.5-72b-instruct'],
    note: 'Free developer access at build.nvidia.com. NVIDIA blocks direct browser calls, so requests pass through this site\'s stateless relay: your key is forwarded to NVIDIA and never stored or logged.',
    keyUrl: 'https://build.nvidia.com/',
  },
  {
    id: 'mistral', label: 'Mistral', group: 'Free key', kind: 'openai', needsKey: true,
    base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', models: ['mistral-small-latest', 'mistral-medium-latest', 'open-mistral-nemo'],
    note: 'Free "Experiment" plan (phone verification).', keyUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'cerebras', label: 'Cerebras', group: 'Free key', kind: 'openai', needsKey: true,
    base: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b', models: ['gpt-oss-120b', 'llama-3.3-70b', 'qwen-3-32b'],
    note: 'Fast free tier; available models change.', keyUrl: 'https://cloud.cerebras.ai/',
  },
  {
    id: 'github', label: 'GitHub Models', group: 'Free key', kind: 'openai', needsKey: true,
    base: 'https://models.github.ai/inference', model: 'openai/gpt-4.1-mini', models: ['openai/gpt-4.1-mini', 'openai/gpt-4.1', 'meta/llama-3.3-70b-instruct'],
    note: 'Free with a GitHub account and low limits. Use a fine-grained token with the "Models: read" permission.',
    keyUrl: 'https://github.com/settings/personal-access-tokens/new',
  },
  // ---- paid keys ----
  {
    id: 'anthropic', label: 'Anthropic Claude', group: 'Paid key (you pay the provider)', kind: 'anthropic', needsKey: true,
    model: 'claude-opus-5-5', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    note: 'No free tier: usage is billed to your own Anthropic account (Haiku 5.5 is the cheapest). Called directly from your browser with Anthropic\'s official SDK.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'meta', label: 'Meta Muse Spark', group: 'Paid key (you pay the provider)', kind: 'openai', needsKey: true, relay: true,
    base: 'https://api.meta.ai/v1', model: 'muse-spark-1.3', models: ['muse-spark-1.3', 'muse-spark-1.1'],
    note: 'Meta Model API (public preview, OpenAI-compatible, per-token pricing). Check dev.meta.ai for current model names and any free allowance. Routed via the stateless relay.',
    keyUrl: 'https://dev.meta.ai/',
  },
  // ---- self-hosted ----
  {
    id: 'custom', label: 'Custom / self-hosted (OpenAI-compatible)', group: 'Self-hosted', kind: 'openai', needsKey: false, custom: true,
    base: 'http://localhost:11434/v1', model: 'llama3.2', models: [],
    note: 'Any OpenAI-compatible endpoint that allows browser requests, e.g. Ollama on your PC or NAS (behind Cloudflare Tunnel). For Ollama set OLLAMA_ORIGINS to this site\'s address.',
    keyUrl: 'https://github.com/ollama/ollama/blob/main/docs/faq.md',
  },
];

export const getProvider = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];

const RELAYABLE = [
  'https://integrate.api.nvidia.com/', 'https://api.meta.ai/', 'https://api.groq.com/', 'https://api.mistral.ai/',
  'https://api.cerebras.ai/', 'https://models.github.ai/', 'https://openrouter.ai/', 'https://generativelanguage.googleapis.com/',
  'https://api.openai.com/', 'https://api.elevenlabs.io/',
];
const canRelay = (url) => RELAYABLE.some((p) => url.startsWith(p));

// fetch() that goes through /api/relay when required, or as a fallback when the browser blocks CORS.
export async function relayFetch(url, init, { forceRelay = false } = {}) {
  const viaRelay = () =>
    fetch(RELAY_URL, { ...init, method: 'POST', headers: { ...init.headers, 'x-relay-target': url } });
  if (forceRelay) return viaRelay();
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err?.name === 'AbortError' || !canRelay(url)) throw err;
    return viaRelay();
  }
}

export async function explainHttpError(res, providerLabel) {
  let detail = '';
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      detail = j.error?.message || j.error || j.message || j.detail || text;
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch { detail = text; }
  } catch { /* ignore */ }
  detail = String(detail).slice(0, 300);
  const hint =
    res.status === 401 || res.status === 403 ? 'Check that the API key is correct and active.' :
    res.status === 404 ? 'The model name may be wrong or retired — pick another in Settings.' :
    res.status === 429 ? 'Rate limit or free quota reached. Wait a bit, or switch provider/model.' :
    res.status === 413 ? 'The request was too large.' :
    res.status >= 500 ? 'The provider is having trouble. Try again or switch provider.' : '';
  return new Error(`${providerLabel} returned ${res.status}. ${hint}${detail ? `\nDetails: ${detail}` : ''}`);
}

// Parse a text/event-stream body into JSON payloads.
async function* sseJson(res) {
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try { yield JSON.parse(data); } catch { /* partial or keep-alive line */ }
    }
  }
}

async function* openaiStream(p, { key, model, base, system, user, signal }) {
  const url = `${(base || p.base).replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'content-type': 'application/json', accept: 'text/event-stream' };
  if (key) headers.authorization = `Bearer ${key}`;
  if (p.id === 'openrouter') { headers['http-referer'] = location.origin; headers['x-title'] = 'Sun Tzu Modern Field Manual'; }
  const body = JSON.stringify({
    model,
    stream: true,
    max_tokens: 1400,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  const res = await relayFetch(url, { method: 'POST', headers, body, signal }, { forceRelay: !!p.relay });
  if (!res.ok) throw await explainHttpError(res, p.label);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('event-stream')) {
    // some gateways ignore stream:true
    const j = await res.json();
    yield j.choices?.[0]?.message?.content || '';
    return;
  }
  for await (const j of sseJson(res)) {
    if (j.error) throw new Error(`${p.label}: ${j.error.message || JSON.stringify(j.error)}`);
    const t = j.choices?.[0]?.delta?.content;
    if (t) yield t;
  }
}

// Anthropic: official SDK in the browser (BYOK). Opus/Sonnet get server-side refusal fallbacks.
async function* anthropicStream(p, { key, model, system, user, signal }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const params = {
    model,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'medium' },
  };
  const withFallback = /^claude-(opus|sonnet-5-5|fable)/.test(model);
  const stream = withFallback
    ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })
    : client.messages.stream(params, { signal });
  try {
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield ev.delta.text;
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new Error('Claude declined this request. Try rephrasing the situation, or choose another model.');
    if (final.stop_reason === 'max_tokens') yield '\n\n_(Answer was cut off at the length limit.)_';
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Anthropic rejected the API key. Check it in Settings.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Anthropic rate limit reached. Wait a moment and try again.');
    if (err instanceof Anthropic.NotFoundError) throw new Error(`Model "${model}" was not found on your Anthropic account. Pick another in Settings.`);
    if (err instanceof Anthropic.APIError) throw new Error(`Anthropic error ${err.status ?? ''}: ${err.message}`);
    throw err;
  }
}

let puterLoading;
function loadPuter() {
  if (window.puter) return Promise.resolve(window.puter);
  puterLoading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.onload = () => resolve(window.puter);
    s.onerror = () => reject(new Error('Could not load Puter.js (blocked by an extension or network?).'));
    document.head.append(s);
  });
  return puterLoading;
}

async function* puterStream(p, { model, system, user }) {
  const puter = await loadPuter();
  const opts = { stream: true };
  if (model) opts.model = model;
  const resp = await puter.ai.chat([{ role: 'system', content: system }, { role: 'user', content: user }], opts);
  if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
    for await (const part of resp) if (part?.text) yield part.text;
  } else {
    yield resp?.message?.content?.[0]?.text || resp?.message?.content || String(resp ?? '');
  }
}

let webllmEngine = null, webllmModel = '';
async function* webllmStream(p, { model, system, user, onStatus }) {
  if (!('gpu' in navigator)) throw new Error('On-device mode needs WebGPU (recent Chrome or Edge on desktop). Choose another provider.');
  const webllm = await import(/* @vite-ignore */ 'https://esm.run/@mlc-ai/web-llm@0.2.87');
  if (!webllmEngine || webllmModel !== model) {
    onStatus?.('Loading the on-device model (first time can take several minutes)…');
    webllmEngine = await webllm.CreateMLCEngine(model, { initProgressCallback: (r) => onStatus?.(r.text) });
    webllmModel = model;
  }
  const chunks = await webllmEngine.chat.completions.create({
    stream: true,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  for await (const c of chunks) {
    const t = c.choices?.[0]?.delta?.content;
    if (t) yield t;
  }
}

/** Stream an answer as text chunks. */
export function streamChat(providerId, opts) {
  const p = getProvider(providerId);
  if (p.needsKey && !opts.key) throw new Error(`Add your ${p.label} key in Settings first.`);
  if (p.kind === 'anthropic') return anthropicStream(p, opts);
  if (p.kind === 'puter') return puterStream(p, opts);
  if (p.kind === 'webllm') return webllmStream(p, opts);
  return openaiStream(p, opts);
}

/** OpenRouter: list currently-free models (public endpoint, no key). */
export async function listOpenRouterFree() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error(`OpenRouter model list failed (${res.status})`);
  const j = await res.json();
  return (j.data || [])
    .filter((m) => m.id.endsWith(':free') || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0))
    .map((m) => ({ id: m.id, ctx: m.context_length }))
    .sort((a, b) => (b.ctx || 0) - (a.ctx || 0));
}
