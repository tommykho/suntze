// Kokoro-82M text-to-speech, fully on the visitor's device (WASM or WebGPU).
// Model weights download once from Hugging Face and are cached by the browser.
import { KokoroTTS } from 'kokoro-js';

let tts = null;
let loadedDevice = '';

self.onmessage = async (e) => {
  const { id, text, voice, speed, device } = e.data;
  try {
    if (!tts || loadedDevice !== device) {
      tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        device,
        progress_callback: (p) => {
          if (p.status === 'progress' && p.total) self.postMessage({ id, type: 'progress', loaded: p.loaded, total: p.total, file: p.file });
        },
      });
      loadedDevice = device;
    }
    // Generate sentence groups separately (keeps each chunk well under the model's token limit).
    const parts = text.match(/[^.!?。！？]+[.!?。！？]*\s*/g)?.map((s) => s.trim()).filter(Boolean) || [text];
    const groups = [];
    for (const s of parts) {
      const last = groups[groups.length - 1];
      if (last && (last + ' ' + s).split(/\s+/).length <= 40) groups[groups.length - 1] = last + ' ' + s;
      else groups.push(s);
    }
    const chunks = [];
    let rate = 24000;
    for (let i = 0; i < groups.length; i++) {
      self.postMessage({ id, type: 'status', text: `Voicing part ${i + 1} of ${groups.length}…` });
      const audio = await tts.generate(groups[i], { voice, speed });
      rate = audio.sampling_rate;
      chunks.push(audio.audio);
    }
    const gap = Math.round(rate * 0.14);
    const total = chunks.reduce((a, c) => a + c.length + gap, 0);
    const out = new Float32Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length + gap; }
    self.postMessage({ id, type: 'done', samples: out, rate }, [out.buffer]);
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String(err?.message || err) });
  }
};
