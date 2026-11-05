// Visitor settings. Keys live only in this browser: localStorage when "remember" is on, otherwise
// sessionStorage (cleared when the tab closes). Every storage access is guarded (private mode etc.).
const SETTINGS = 'sz.settings.v2'; // v2: new defaults (Puter.js, Kokoro Heart, GPU on)
const KEYS = 'sz.keys.v1';

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const read = (store, k) => safe(() => JSON.parse(store.getItem(k) || 'null'), null);
const write = (store, k, v) => safe(() => store.setItem(k, JSON.stringify(v)));
const remove = (store, k) => safe(() => store.removeItem(k));

export const DEFAULTS = {
  provider: 'puter',
  models: {},
  bases: {},
  remember: false,
  tts: { engine: 'kokoro', voice: 'af_heart', speed: 1, gpu: true, openaiVoice: 'onyx', elevenVoice: 'JBFqnCBsd6RMkjVDRZzb', geminiModel: 'gemini-2.5-flash-preview-tts', geminiVoice: 'Charon', intro: true },
};

export function loadSettings() {
  const s = read(localStorage, SETTINGS) || {};
  return { ...DEFAULTS, ...s, tts: { ...DEFAULTS.tts, ...(s.tts || {}) } };
}
export function saveSettings(s) { write(localStorage, SETTINGS, s); }

export function loadKeys() {
  return { ...(safe(() => read(sessionStorage, KEYS), null) || {}), ...(read(localStorage, KEYS) || {}) };
}
export function saveKeys(keys, remember) {
  const clean = Object.fromEntries(Object.entries(keys).filter(([, v]) => v));
  if (remember) { write(localStorage, KEYS, clean); safe(() => remove(sessionStorage, KEYS)); }
  else { safe(() => write(sessionStorage, KEYS, clean)); remove(localStorage, KEYS); }
}
export function clearKeys() { remove(localStorage, KEYS); safe(() => remove(sessionStorage, KEYS)); }
