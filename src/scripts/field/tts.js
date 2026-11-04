// Podcast audio: Kokoro on-device (default, free) or the visitor's own TTS key (OpenAI, ElevenLabs,
// Gemini). Output is always an MP3 Blob the visitor can download.
import { relayFetch, explainHttpError } from './providers.js';

export const KOKORO_VOICES = [
  ['am_michael', 'Michael — US, male, steady'],
  ['am_fenrir', 'Fenrir — US, male, deep'],
  ['bm_george', 'George — UK, male, mature'],
  ['bm_fable', 'Fable — UK, male, storyteller'],
  ['af_heart', 'Heart — US, female, warm'],
  ['af_bella', 'Bella — US, female, bright'],
  ['bf_emma', 'Emma — UK, female, calm'],
  ['bf_isabella', 'Isabella — UK, female, clear'],
];

let worker = null;
let seq = 0;

function kokoro(text, { voice, speed, gpu }, onStatus) {
  worker ||= new Worker(new URL('./kokoro.worker.js', import.meta.url), { type: 'module' });
  const id = ++seq;
  const device = gpu && 'gpu' in navigator ? 'webgpu' : 'wasm';
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      const d = e.data;
      if (d.id !== id) return;
      if (d.type === 'progress') onStatus?.(`Downloading voice model… ${Math.round((d.loaded / d.total) * 100)}% (one time, cached afterwards)`);
      else if (d.type === 'status') onStatus?.(d.text);
      else if (d.type === 'done') { worker.removeEventListener('message', onMsg); resolve({ samples: d.samples, rate: d.rate }); }
      else if (d.type === 'error') { worker.removeEventListener('message', onMsg); reject(new Error(`On-device voice failed: ${d.message}`)); }
    };
    worker.addEventListener('message', onMsg);
    worker.onerror = (e) => reject(new Error(`Voice worker failed to start: ${e.message || 'unknown error'}`));
    onStatus?.('Starting the on-device voice engine…');
    worker.postMessage({ id, text, voice, speed, device });
  });
}

// ---- PCM helpers ----
function pcm16ToFloat(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

/** A soft singing-bowl tone (synthesised, royalty-free) for the intro/outro. */
function bowl(rate, seconds = 2.4, f0 = 196) {
  const n = Math.round(rate * seconds);
  const out = new Float32Array(n);
  const partials = [[1, 1, 1.6], [2.76, 0.42, 2.4], [5.4, 0.18, 3.6], [8.93, 0.08, 5]];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let s = 0;
    for (const [mult, amp, decay] of partials) s += amp * Math.sin(2 * Math.PI * f0 * mult * t + Math.sin(2 * Math.PI * 4.5 * t) * 0.08) * Math.exp(-decay * t);
    out[i] = s * 0.16 * Math.min(1, t / 0.005);
  }
  return out;
}

function withIntro(voice, rate) {
  const intro = bowl(rate, 2.4, 196);
  const outro = bowl(rate, 2.0, 233);
  const lead = Math.round(rate * 0.9); // voice starts while the bowl rings
  const tail = Math.round(rate * 0.35);
  const total = lead + voice.length + tail + outro.length;
  const out = new Float32Array(total);
  for (let i = 0; i < intro.length && i < total; i++) out[i] += intro[i];
  out.set(voice.map((v, i) => v + (out[lead + i] || 0)), lead);
  const o = lead + voice.length + tail;
  for (let i = 0; i < outro.length; i++) out[o + i] += outro[i] * 0.8;
  // gentle limiter
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i] *= 0.98 / peak;
  return out;
}

export async function encodeMp3(samples, rate, kbps = 96) {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const enc = new Mp3Encoder(1, rate, kbps);
  const block = 1152;
  const parts = [];
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
  for (let i = 0; i < pcm.length; i += block) {
    const buf = enc.encodeBuffer(pcm.subarray(i, i + block));
    if (buf.length) parts.push(new Uint8Array(buf));
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  return new Blob(parts, { type: 'audio/mpeg' });
}

/** Produce an MP3 Blob for `text`. */
export async function synthesize(text, s, keys, onStatus) {
  const clean = text.replace(/\[[^\]]*\]/g, '').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('The podcast script is empty.');

  if (s.engine === 'kokoro') {
    const { samples, rate } = await kokoro(clean, s, onStatus);
    onStatus?.('Encoding MP3…');
    return encodeMp3(s.intro ? withIntro(samples, rate) : samples, rate);
  }

  if (s.engine === 'gemini') {
    if (!keys.gemini) throw new Error('Add your Gemini key in Settings to use Gemini voices.');
    onStatus?.('Asking Gemini to voice the script…');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.geminiModel)}:generateContent`;
    const res = await relayFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': keys.gemini },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Read this as a calm, warm, unhurried podcast host:\n\n${clean}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: s.geminiVoice } } } },
      }),
    });
    if (!res.ok) throw await explainHttpError(res, 'Gemini TTS');
    const j = await res.json();
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error('Gemini returned no audio. The TTS model name may have changed — edit it in Settings.');
    const bytes = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0));
    const rate = Number((part.inlineData.mimeType || '').match(/rate=(\d+)/)?.[1]) || 24000;
    const pcm = pcm16ToFloat(bytes);
    onStatus?.('Encoding MP3…');
    return encodeMp3(s.intro ? withIntro(pcm, rate) : pcm, rate);
  }

  if (s.engine === 'openai') {
    if (!keys.openai) throw new Error('Add your OpenAI key in Settings to use OpenAI voices.');
    onStatus?.('Asking OpenAI to voice the script…');
    const res = await relayFetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${keys.openai}` },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: s.openaiVoice, input: clean, response_format: 'mp3', instructions: 'Calm, warm, measured podcast host. Slight pauses between sentences.' }),
    });
    if (!res.ok) throw await explainHttpError(res, 'OpenAI TTS');
    return new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' });
  }

  if (s.engine === 'elevenlabs') {
    if (!keys.elevenlabs) throw new Error('Add your ElevenLabs key in Settings to use ElevenLabs voices.');
    onStatus?.('Asking ElevenLabs to voice the script…');
    const res = await relayFetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(s.elevenVoice)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': keys.elevenlabs, accept: 'audio/mpeg' },
      body: JSON.stringify({ text: clean, model_id: 'eleven_multilingual_v2' }),
    });
    if (!res.ok) throw await explainHttpError(res, 'ElevenLabs');
    return new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' });
  }
  throw new Error('Unknown voice engine.');
}

/** Build a ~30 s script from a library tactic (no AI needed). */
export function scriptFromTactic(t) {
  const moves = t.moves.slice(0, 3).map((m) => (typeof m === 'string' ? m : m.title).replace(/\.$/, '')).join('. ') + '.';
  const firstSentences = t.scene.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  return `${firstSentences} Sun Tzu's answer: ${t.principle.replace(/\.$/, '')}. Your moves: ${moves} Today's takeaway: ${t.title}.`;
}

export const wordCount = (s) => (s.trim().match(/\S+/g) || []).length;
export const estSeconds = (s) => Math.round((wordCount(s) / 150) * 60);
