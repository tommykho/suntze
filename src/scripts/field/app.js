// Field Challenge controller: settings dialog, retrieval → prompt → streamed answer, citation
// verification, manual-only mode, and the podcast studio.
import { PROVIDERS, getProvider, streamChat, listOpenRouterFree } from './providers.js';
import { loadSettings, saveSettings, loadKeys, saveKeys, clearKeys } from './settings.js';
import { loadCorpus, retrieve } from './retrieval.js';
import { SYSTEM_PROMPT, buildUserPrompt, parseSections, verifyCitations } from './prompt.js';
import { renderMarkdown, esc } from './render.js';
import { synthesize, scriptFromTactic, wordCount, estSeconds } from './tts.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let settings = loadSettings();
let keys = loadKeys();
let db = null;
let controller = null;
let lastAnswer = '';
let lastSituation = '';
let audioUrl = '';

const ui = {
  form: $('[data-form]'), situation: $('[data-situation]'), chars: $('[data-chars]'), status: $('[data-status]'),
  ask: $('[data-ask]'), manual: $('[data-manual]'), stop: $('[data-stop]'), providerNow: $('[data-provider-now]'),
  answer: $('[data-answer]'), verify: $('[data-verify]'), outTools: $('[data-out-tools]'),
  dialog: $('[data-settings]'), provider: $('[data-provider]'), providerNote: $('[data-provider-note]'),
  key: $('[data-key]'), keyRow: $('[data-key-row]'), keyLink: $('[data-key-link]'), baseRow: $('[data-base-row]'), base: $('[data-base]'),
  model: $('[data-model]'), modelList: $('[data-model-list]'), loadFree: $('[data-load-free]'), remember: $('[data-remember]'),
  script: $('[data-script]'), words: $('[data-words]'), secs: $('[data-secs]'), engine: $('[data-engine]'), voice: $('[data-voice]'),
  speed: $('[data-speed]'), speedOut: $('[data-speed-out]'), intro: $('[data-intro]'), gpu: $('[data-gpu]'),
  speak: $('[data-speak]'), download: $('[data-download]'), ttsStatus: $('[data-tts-status]'), audio: $('[data-audio]'),
  pop: $('[data-verse-pop]'),
};

const modelFor = (p) => settings.models[p.id] || p.model;
const baseFor = (p) => settings.bases[p.id] || p.base;

// ---------------- provider summary ----------------
function showProviderNow() {
  const p = getProvider(settings.provider);
  const hasKey = !p.needsKey || !!keys[p.id];
  ui.providerNow.innerHTML = `${esc(p.label)} <small>· ${esc(modelFor(p) || 'default model')}</small>${hasKey ? '' : ' <small style="color:#f6c4b8">· key needed</small>'}`;
}

// ---------------- settings dialog ----------------
function fillProvider(id) {
  const p = getProvider(id);
  ui.providerNote.textContent = p.note;
  ui.keyRow.hidden = !p.needsKey && !p.custom;
  ui.key.value = keys[p.id] || '';
  ui.key.placeholder = p.custom ? 'Optional' : 'Paste your key';
  ui.keyLink.href = p.keyUrl;
  ui.keyLink.textContent = p.needsKey ? `Get a ${p.label} key →` : 'How it works →';
  ui.baseRow.hidden = !p.custom;
  ui.base.value = baseFor(p) || '';
  ui.model.value = modelFor(p);
  ui.modelList.innerHTML = (p.models || []).map((m) => `<option value="${esc(m)}"></option>`).join('');
  ui.loadFree.hidden = !p.listFree;
}

function openSettings() {
  ui.provider.value = settings.provider;
  fillProvider(settings.provider);
  ui.remember.checked = !!settings.remember;
  $$('[data-tkey]').forEach((el) => (el.value = keys[el.dataset.tkey] || ''));
  $$('[data-tset]').forEach((el) => (el.value = settings.tts[el.dataset.tset] || ''));
  ui.dialog.showModal();
}

function saveFromDialog() {
  const p = getProvider(ui.provider.value);
  settings.provider = p.id;
  settings.models[p.id] = ui.model.value.trim() || p.model;
  if (p.custom) settings.bases[p.id] = ui.base.value.trim();
  settings.remember = ui.remember.checked;
  $$('[data-tkey]').forEach((el) => (keys[el.dataset.tkey] = el.value.trim()));
  // provider key last: the Gemini strategist and Gemini TTS share one key ("gemini")
  if (!ui.keyRow.hidden) keys[p.id] = ui.key.value.trim();
  $$('[data-tset]').forEach((el) => el.value.trim() && (settings.tts[el.dataset.tset] = el.value.trim()));
  saveSettings(settings);
  saveKeys(keys, settings.remember);
  showProviderNow();
}

ui.provider.addEventListener('change', () => fillProvider(ui.provider.value));
$('[data-open-settings]').addEventListener('click', openSettings);
$('[data-save]').addEventListener('click', saveFromDialog);
$('[data-toggle-key]').addEventListener('click', (e) => {
  const show = ui.key.type === 'password';
  ui.key.type = show ? 'text' : 'password';
  e.currentTarget.textContent = show ? 'Hide' : 'Show';
});
$('[data-clear-keys]').addEventListener('click', () => {
  clearKeys();
  keys = {};
  ui.key.value = '';
  $$('[data-tkey]').forEach((el) => (el.value = ''));
  showProviderNow();
  ui.providerNote.textContent = 'All keys were removed from this browser.';
});
ui.loadFree.addEventListener('click', async () => {
  ui.loadFree.disabled = true;
  ui.loadFree.textContent = 'Loading…';
  try {
    const list = await listOpenRouterFree();
    ui.modelList.innerHTML = list.map((m) => `<option value="${esc(m.id)}">${m.ctx ? `${Math.round(m.ctx / 1000)}k context` : ''}</option>`).join('');
    ui.providerNote.textContent = `${list.length} free models available right now. Click the model field to choose.`;
    if (list.length && !list.some((m) => m.id === ui.model.value)) ui.model.value = list[0].id;
  } catch (err) {
    ui.providerNote.textContent = err.message;
  } finally {
    ui.loadFree.disabled = false;
    ui.loadFree.textContent = 'Load free models';
  }
});

// ---------------- input helpers ----------------
const updateChars = () => (ui.chars.textContent = ui.situation.value.length);
ui.situation.addEventListener('input', updateChars);
$$('[data-example]').forEach((b) => b.addEventListener('click', () => { ui.situation.value = b.dataset.example; updateChars(); ui.situation.focus(); }));

const setStatus = (t) => (ui.status.textContent = t || '');
const busy = (on) => {
  ui.ask.disabled = on;
  ui.manual.disabled = on;
  ui.stop.hidden = !on;
};

async function getDb() {
  if (!db) { setStatus('Loading the book…'); db = await loadCorpus(); setStatus(''); }
  return db;
}

// ---------------- verification panel ----------------
function renderVerification(md) {
  const { cites, quotes } = verifyCitations(md, db.verseById);
  if (!cites.length) {
    ui.verify.hidden = false;
    ui.verify.innerHTML = '<h3>Source check</h3><p class="hint">No verse citations found in this answer. Treat it as general advice, or ask again.</p>';
    return;
  }
  const qById = new Map(quotes.map((q) => [q.id, q]));
  ui.verify.hidden = false;
  ui.verify.innerHTML =
    '<h3>Source check · verses quoted from the book</h3>' +
    cites
      .map(({ id, verse }) => {
        if (!verse) return `<div class="vcard"><span class="vid">${esc(id)}</span><span class="badge bad">Not in the book</span><p class="hint" style="margin-top:6px">The model cited a verse that does not exist. Ignore this reference.</p></div>`;
        const q = qById.get(id);
        const badge = q ? (q.exact ? '<span class="badge ok">Exact quote</span>' : '<span class="badge warn">Paraphrased</span>') : '<span class="badge ok">Verified ID</span>';
        const [ch] = id.split('.');
        return `<div class="vcard"><a class="vid" href="/chapters/${ch}/#v${id.replace('.', '-')}">${esc(id)} →</a>${badge}<p style="margin:6px 0 0">${esc(verse.en)}</p>${verse.zh ? `<p class="zh" lang="zh-Hant">${esc(verse.zh)}</p>` : ''}</div>`;
      })
      .join('');
}

// ---------------- consult ----------------
ui.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const situation = ui.situation.value.trim();
  if (situation.length < 12) { setStatus('Describe the situation in a sentence or two first.'); ui.situation.focus(); return; }
  const p = getProvider(settings.provider);
  if (p.needsKey && !keys[p.id]) { setStatus(`Add your ${p.label} key first (free to get).`); openSettings(); return; }

  busy(true);
  controller = new AbortController();
  lastAnswer = '';
  lastSituation = situation;
  ui.verify.hidden = true;
  ui.outTools.hidden = true;
  ui.answer.innerHTML = '<p class="hint">Reading the field…</p>';
  try {
    await getDb();
    const r = retrieve(db, situation);
    const user = buildUserPrompt(situation, r);
    setStatus(`Consulting ${p.label}…`);
    let pending = false;
    let finished = false;
    const paint = () => { pending = false; if (!finished) ui.answer.innerHTML = renderMarkdown(lastAnswer, db.verseById) + '<span class="cursor"></span>'; };
    const stream = streamChat(p.id, {
      key: keys[p.id], model: modelFor(p), base: baseFor(p), system: SYSTEM_PROMPT, user, signal: controller.signal, onStatus: setStatus,
    });
    for await (const chunk of stream) {
      if (controller.signal.aborted) break;
      lastAnswer += chunk;
      if (!pending) { pending = true; requestAnimationFrame(paint); }
    }
    finished = true;
    if (!lastAnswer.trim()) throw new Error('The model returned an empty answer. Try again or pick another model.');
    ui.answer.innerHTML = renderMarkdown(lastAnswer, db.verseById);
    renderVerification(lastAnswer);
    ui.outTools.hidden = false;
    const pod = parseSections(lastAnswer)['Podcast Script'];
    if (pod) { ui.script.value = pod.replace(/^[-*]\s*/gm, '').trim(); updateWords(); }
    setStatus(controller.signal.aborted ? 'Stopped.' : 'Done. Scroll down to turn the plan into a podcast.');
  } catch (err) {
    if (err?.name === 'AbortError') { setStatus('Stopped.'); }
    else {
      ui.answer.innerHTML = (lastAnswer ? renderMarkdown(lastAnswer, db?.verseById) : '') + `<div class="error">${esc(err.message || String(err))}</div>`;
      setStatus('');
    }
  } finally {
    busy(false);
    controller = null;
  }
});
ui.stop.addEventListener('click', () => controller?.abort());

// ---------------- manual only (no AI) ----------------
ui.manual.addEventListener('click', async () => {
  const situation = ui.situation.value.trim();
  if (!situation) { setStatus('Type a few words about your situation first.'); ui.situation.focus(); return; }
  await getDb();
  const r = retrieve(db, situation, { verses: 4, tactics: 4 });
  ui.verify.hidden = true;
  ui.outTools.hidden = true;
  if (!r.tactics.length && !r.topVerses.length) {
    ui.answer.innerHTML = '<p>No close match in the manual. Try other words (e.g. “manager”, “deadline”, “family”), or ask the AI strategist.</p>';
    return;
  }
  ui.answer.innerHTML =
    `<div class="manual"><h3 class="ans-h">Closest tactics</h3>${r.tactics
      .map((t) => `<a class="mt" href="/tactics/${esc(t.slug)}/"><strong>${esc(t.title)}</strong><br><span class="hint">${esc(t.situation)}</span></a>`)
      .join('')}<h3 class="ans-h">Verses that speak to it</h3>${r.topVerses
      .map((v) => `<p><button type="button" class="cite" data-cite="${v.id}">${v.id}</button> ${esc(v.en)}</p>`)
      .join('')}</div>`;
  if (r.tactics[0]) { ui.script.value = scriptFromTactic(r.tactics[0]); updateWords(); }
  setStatus('Manual results: instant, offline, no key.');
});

// ---------------- copy / share ----------------
$('[data-copy-answer]').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText(lastAnswer); e.currentTarget.textContent = 'Copied'; } catch { /* ignore */ }
});
$('[data-share]').addEventListener('click', () => {
  const s = parseSections(lastAnswer);
  const draft = {
    situation: lastSituation,
    tactic: [s['Your Moves'], s['Message to Send'] ? `Message:\n${s['Message to Send']}` : ''].filter(Boolean).join('\n\n'),
    verses: verifyCitations(lastAnswer, db.verseById).cites.filter((c) => c.verse).map((c) => c.id),
  };
  try { localStorage.setItem('sz.community.draft', JSON.stringify(draft)); } catch { /* ignore */ }
  location.href = '/community/#new';
});

// ---------------- verse popover ----------------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cite]');
  if (!btn) { if (!e.target.closest('[data-verse-pop]')) ui.pop.hidden = true; return; }
  const v = db?.verseById.get(btn.dataset.cite);
  if (!v) return;
  const [ch] = v.id.split('.');
  ui.pop.innerHTML = `<p>${esc(v.en)}</p>${v.zh ? `<p class="zh" lang="zh-Hant">${esc(v.zh)}</p>` : ''}<a href="/chapters/${ch}/#v${v.id.replace('.', '-')}">Read ${esc(v.id)} in context →</a>`;
  ui.pop.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = Math.min(420, innerWidth - 32);
  ui.pop.style.left = `${Math.max(16, Math.min(r.left, innerWidth - w - 16))}px`;
  const below = r.bottom + 10;
  ui.pop.style.top = `${below + ui.pop.offsetHeight > innerHeight ? Math.max(16, r.top - ui.pop.offsetHeight - 10) : below}px`;
});
addEventListener('scroll', () => (ui.pop.hidden = true), { passive: true });

// ---------------- podcast studio ----------------
function updateWords() {
  ui.words.textContent = wordCount(ui.script.value);
  ui.secs.textContent = estSeconds(ui.script.value);
}
ui.script.addEventListener('input', updateWords);
const syncTtsUi = () => {
  const k = ui.engine.value === 'kokoro';
  $$('[data-kokoro-only]').forEach((el) => (el.hidden = !k));
};
ui.engine.value = settings.tts.engine;
ui.voice.value = settings.tts.voice;
ui.speed.value = settings.tts.speed;
ui.speedOut.textContent = `${Number(settings.tts.speed).toFixed(2)}×`;
ui.intro.checked = settings.tts.intro;
ui.gpu.checked = settings.tts.gpu;
syncTtsUi();
const persistTts = () => {
  Object.assign(settings.tts, { engine: ui.engine.value, voice: ui.voice.value, speed: Number(ui.speed.value), intro: ui.intro.checked, gpu: ui.gpu.checked });
  ui.speedOut.textContent = `${Number(ui.speed.value).toFixed(2)}×`;
  saveSettings(settings);
  syncTtsUi();
};
[ui.engine, ui.voice, ui.speed, ui.intro, ui.gpu].forEach((el) => el.addEventListener('change', persistTts));
ui.speed.addEventListener('input', () => (ui.speedOut.textContent = `${Number(ui.speed.value).toFixed(2)}×`));

ui.speak.addEventListener('click', async () => {
  persistTts();
  ui.speak.disabled = true;
  ui.download.hidden = true;
  ui.ttsStatus.textContent = 'Preparing…';
  try {
    const blob = await synthesize(ui.script.value, settings.tts, keys, (t) => (ui.ttsStatus.textContent = t));
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    ui.audio.src = audioUrl;
    ui.audio.hidden = false;
    ui.download.href = audioUrl;
    const stamp = new Date().toISOString().slice(0, 10);
    ui.download.download = `sun-tzu-field-podcast-${stamp}.mp3`;
    ui.download.hidden = false;
    ui.ttsStatus.textContent = `Ready · ${(blob.size / 1024).toFixed(0)} KB MP3`;
  } catch (err) {
    ui.ttsStatus.textContent = err.message || String(err);
  } finally {
    ui.speak.disabled = false;
  }
});

// ---------------- deep links ----------------
(async function init() {
  showProviderNow();
  const params = new URLSearchParams(location.search);
  if (params.get('q')) { ui.situation.value = params.get('q').slice(0, 4000); updateChars(); }
  const slug = params.get('tactic');
  if (slug) {
    await getDb();
    const t = db.tacticBySlug.get(slug);
    if (t) {
      ui.script.value = scriptFromTactic(t);
      updateWords();
      ui.situation.value ||= t.situation;
      updateChars();
      document.getElementById('podcast')?.scrollIntoView({ behavior: 'smooth' });
    }
  }
})();
