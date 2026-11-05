// Field Challenge: exam modes 探花 6 · 榜眼 12 · 狀元 20, multi-select moves, percentage scoring,
// General rank at the end. Questions cycle through the bank (unseen first) across runs.
import { BASE as B } from '../lib/url.js';
import { RANKS, rankForScore } from '../lib/ranks.js';
import { MODES, modeById } from '../lib/modes.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DOMAIN = { work: 'Work', career: 'Career', business: 'Business', personal: 'Personal', family: 'Family', self: 'Self' };
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const STORE = 'sz.challenge.v2';
let mode = MODES[1];

const stages = { intro: $('[data-stage="intro"]'), quiz: $('[data-stage="quiz"]'), results: $('[data-stage="results"]') };
const show = (name) => {
  Object.entries(stages).forEach(([k, el]) => (el.hidden = k !== name));
  window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : scrollTo(0, 0);
  window.dispatchEvent(new Event('resize'));
};

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const emptyStore = () => ({ best: {}, runs: [], seen: [] });
const readStore = () => { try { return { ...emptyStore(), ...(JSON.parse(localStorage.getItem(STORE)) || {}) }; } catch { return emptyStore(); } };
const writeStore = (s) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* storage blocked */ } };

/**
 * Score for one question = correct ÷ (correct + missed).
 * "Correct" = right moves picked. "Missed" = right moves left out + wrong moves picked.
 */
export function scoreQuestion(options, picked) {
  const correct = options.filter((o) => o.correct).length;
  const hits = options.filter((o, i) => o.correct && picked.has(i)).length;
  const wrong = options.filter((o, i) => !o.correct && picked.has(i)).length;
  const missed = correct - hits + wrong;
  return { correct, hits, wrong, missed, pct: hits / (hits + missed) };
}

/**
 * Pick n questions. Unseen questions come first (the bank cycles across runs; when fewer than n are
 * unseen, the cycle restarts). Within the pool, spread across chapters, then show in book order.
 */
function pickRound(bank, n) {
  const store = readStore();
  let seen = new Set(store.seen);
  let pool = bank.filter((q) => !seen.has(q.id));
  let carry = [];
  if (pool.length < n) { carry = pool; seen = new Set(carry.map((q) => q.id)); pool = bank.filter((q) => !seen.has(q.id)); }
  const chosen = [...carry];
  const byCh = new Map();
  for (const q of shuffle(pool)) { if (!byCh.has(q.chapter)) byCh.set(q.chapter, []); byCh.get(q.chapter).push(q); }
  const chapters = shuffle([...byCh.keys()]);
  while (chosen.length < Math.min(n, bank.length) && chapters.some((c) => byCh.get(c).length)) {
    for (const c of chapters) { if (chosen.length >= n) break; const q = byCh.get(c).shift(); if (q) chosen.push(q); }
  }
  store.seen = [...seen, ...chosen.filter((q) => !carry.includes(q)).map((q) => q.id)];
  writeStore(store);
  return chosen
    .sort((a, b) => a.chapter - b.chapter)
    .map((q) => ({ ...q, options: shuffle(q.options) }));
}

let bank = [];
let round = [];
let idx = 0;
let picked = new Set();
let results = [];
let locked = false;

function renderBest() {
  const s = readStore();
  for (const m of MODES) {
    const el = $(`[data-mode-best="${m.id}"]`);
    const b = s.best[m.id];
    if (el) el.textContent = b != null ? `Best ${b}% · ${rankForScore(b).en} ${rankForScore(b).zh}` : '';
  }
  const bankSize = bank.length || 30;
  $('[data-best]').textContent = s.runs.length ? `${s.runs.length} exam${s.runs.length === 1 ? '' : 's'} taken · ${Math.min(s.seen.length, bankSize)} of ${bankSize} scenarios seen this cycle` : '';
}

function renderPips() {
  $('[data-pips]').style.gridTemplateColumns = `repeat(${round.length}, 1fr)`;
  $('[data-pips]').innerHTML = round
    .map((_, i) => {
      const r = results[i];
      const cls = r ? (r.pct >= 0.999 ? 's-perfect' : r.pct > 0 ? 's-part' : 's-zero') : i === idx ? 'now' : '';
      return `<li class="${cls}"></li>`;
    })
    .join('');
  const done = results.filter(Boolean);
  $('[data-running]').textContent = done.length ? `${Math.round((done.reduce((a, r) => a + r.pct, 0) / done.length) * 100)}%` : '–';
}

function renderQuestion() {
  const q = round[idx];
  picked = new Set();
  locked = false;
  $('[data-counter]').textContent = `${mode.zh} ${mode.en} · Scenario ${idx + 1} / ${round.length}`;
  $('[data-q-seal]').textContent = q.chapterZh;
  $('[data-q-chapter]').textContent = `Chapter ${q.roman} · ${q.chapterTitle} ${q.chapterZh}`;
  $('[data-q-domain]').textContent = DOMAIN[q.domain] || q.domain;
  $('[data-q-diff]').textContent = '●'.repeat(q.difficulty) + '○'.repeat(3 - q.difficulty);
  $('[data-q-diff]').title = `Difficulty ${q.difficulty} of 3`;
  $('[data-q-title]').textContent = q.title;
  $('[data-q-text]').textContent = q.scenario;
  $('[data-outcome]').hidden = true;
  const set = $('[data-options]');
  set.classList.remove('is-locked');
  set.innerHTML =
    '<legend class="label">Possible moves</legend>' +
    q.options
      .map(
        (o, i) => `<label class="move-opt" data-opt="${i}">
          <input type="checkbox" value="${i}" aria-describedby="why-${i}" />
          <span class="move-key">${LETTERS[i]}</span>
          <span class="move-text">${esc(o.text)}</span>
          <span class="move-tag" hidden></span>
          <p class="move-why" id="why-${i}" hidden>${esc(o.why)}</p>
        </label>`,
      )
      .join('');
  $$('.move-opt input', set).forEach((inp) =>
    inp.addEventListener('change', () => {
      if (locked) { inp.checked = picked.has(Number(inp.value)); return; }
      const i = Number(inp.value);
      inp.checked ? picked.add(i) : picked.delete(i);
      inp.closest('.move-opt').classList.toggle('is-on', inp.checked);
      $('[data-confirm]').disabled = picked.size === 0;
    }),
  );
  $('[data-confirm]').hidden = false;
  $('[data-confirm]').disabled = true;
  $('[data-next]').hidden = true;
  renderPips();
  animateIn();
}

function animateIn() {
  const g = window.__gsap;
  if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  g.fromTo('[data-scenario-card]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' });
  g.fromTo($$('.move-opt'), { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.5, ease: 'expo.out', stagger: 0.06 });
}

function confirm() {
  if (locked || picked.size === 0) return;
  locked = true;
  const q = round[idx];
  const r = scoreQuestion(q.options, picked);
  results[idx] = { ...r, id: q.id };
  const set = $('[data-options]');
  set.classList.add('is-locked');
  q.options.forEach((o, i) => {
    const el = $(`[data-opt="${i}"]`, set);
    const on = picked.has(i);
    const state = o.correct && on ? 'r-hit' : o.correct ? 'r-miss' : on ? 'r-wrong' : 'r-ok';
    const tag = { 'r-hit': '✓ Right move', 'r-miss': '○ Missed right move', 'r-wrong': '✗ Reckless move', 'r-ok': 'Rightly avoided' }[state];
    el.classList.remove('is-on');
    el.classList.add(state);
    const t = $('.move-tag', el); t.textContent = tag; t.hidden = false;
    $('.move-why', el).hidden = false;
    $('input', el).disabled = true;
  });
  const pct = Math.round(r.pct * 100);
  const missParts = [];
  if (r.correct - r.hits) missParts.push(`${r.correct - r.hits} right move${r.correct - r.hits === 1 ? '' : 's'} left out`);
  if (r.wrong) missParts.push(`${r.wrong} reckless pick${r.wrong === 1 ? '' : 's'}`);
  const parts = [`${r.hits} correct`, `${r.missed} missed${missParts.length ? ` (${missParts.join(', ')})` : ''}`, `${r.hits} ÷ ${r.hits + r.missed}`];
  const out = $('[data-outcome]');
  out.innerHTML = `
    <div class="oc-score"><strong>${pct}%</strong><span>${esc(parts.join(' · '))}</span></div>
    <p class="oc-lesson">${esc(q.lesson)}</p>
    ${q.verses.map((vv) => `<div class="oc-verse"><p>“${esc(vv.en)}”</p>${vv.zh ? `<p class="zh" lang="zh-Hant">${esc(vv.zh)}</p>` : ''}<a href="${B}/chapters/${vv.id.split('.')[0]}/#v${vv.id.replace('.', '-')}">Sun Tzu ${esc(vv.label)} →</a></div>`).join('')}
    ${q.tactic ? `<div class="oc-links"><a class="chip chip--seal" href="${B}/tactics/${esc(q.tactic.slug)}/">Tactic: ${esc(q.tactic.title)}</a></div>` : ''}`;
  out.hidden = false;
  $('[data-confirm]').hidden = true;
  const next = $('[data-next]');
  next.hidden = false;
  next.textContent = idx === round.length - 1 ? 'See my rank →' : 'Next scenario →';
  next.focus({ preventScroll: true });
  renderPips();
  window.__gsap?.from('.oc-score strong', { scale: 1.4, opacity: 0, duration: 0.5, ease: 'back.out(2)' });
  if (innerWidth < 900) out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function next() {
  if (idx < round.length - 1) { idx++; renderQuestion(); window.__lenis ? window.__lenis.scrollTo('[data-stage="quiz"]', { offset: -100 }) : scrollTo(0, 0); return; }
  finish();
}

function finish() {
  const avg = results.reduce((a, r) => a + r.pct, 0) / results.length;
  const pct = Math.round(avg * 100);
  const rank = rankForScore(pct);
  const store = readStore();
  store.runs.push({ date: new Date().toISOString().slice(0, 10), mode: mode.id, score: pct });
  store.runs = store.runs.slice(-50);
  store.best[mode.id] = Math.max(store.best[mode.id] ?? 0, pct);
  writeStore(store);
  const best = store.best[mode.id];
  $('[data-res-mode]').textContent = `${mode.zh} ${mode.en} exam · ${round.length} battles`;

  $('[data-res-seal]').textContent = rank.zh;
  $('[data-res-rank]').textContent = `${rank.en} ${rank.zh}`;
  const nextRank = RANKS[RANKS.indexOf(rank) + 1];
  $('[data-res-blurb]').textContent = `${rank.blurb}${nextRank ? ` Reach ${nextRank.min}% to become a ${nextRank.en}.` : ' The highest rank. Sun Tzu would hire you.'}`;
  const perfect = results.filter((r) => r.pct >= 0.999).length;
  const hits = results.reduce((a, r) => a + r.hits, 0);
  const missed = results.reduce((a, r) => a + r.missed, 0);
  $('[data-res-stats]').innerHTML = `
    <div><strong>${perfect}/${results.length}</strong><span>Perfect battles</span></div>
    <div><strong>${hits}</strong><span>Correct moves</span></div>
    <div><strong>${missed}</strong><span>Missed (left out or reckless)</span></div>
    <div><strong>${best}%</strong><span>Your best ${mode.zh}</span></div>`;
  $('[data-res-list]').innerHTML = round
    .map((q, i) => {
      const p = Math.round(results[i].pct * 100);
      const link = q.tactic ? `<a href="${B}/tactics/${esc(q.tactic.slug)}/">Study →</a>` : `<a href="${B}/chapters/${q.chapter}/">Chapter →</a>`;
      return `<li><span class="rl-pct ${p === 100 ? 'p100' : p === 0 ? 'p0' : ''}">${p}%</span><span><span class="rl-title">${esc(q.title)}</span><span class="rl-meta">Chapter ${q.roman} · ${esc(q.chapterTitle)} · ${esc(DOMAIN[q.domain])}</span></span>${link}</li>`;
    })
    .join('');
  show('results');
  const el = $('[data-res-score]');
  const g = window.__gsap;
  if (g && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const o = { v: 0 };
    g.to(o, { v: pct, duration: 1.6, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) });
    g.from('[data-res-seal]', { scale: 2.4, rotate: -40, opacity: 0, duration: 0.8, ease: 'back.out(2)', delay: 0.4 });
  } else el.textContent = pct;
  $('[data-copy-result]').onclick = async (e) => {
    const text = `I scored ${pct}% in the ${mode.zh} (${mode.en}, ${round.length} battles) Sun Tzu Field Challenge and earned the rank of ${rank.en} ${rank.zh}. ${perfect}/${results.length} perfect battles. ${location.origin}${B}/field/`;
    try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; } catch { /* clipboard blocked */ }
  };
}

async function start() {
  const btn = $('[data-start]');
  btn.disabled = true;
  btn.textContent = 'Preparing the field…';
  try {
    if (!bank.length) {
      const res = await fetch(`${B}/challenge.json`);
      if (!res.ok) throw new Error('Could not load the scenarios.');
      bank = (await res.json()).questions;
    }
    mode = modeById($('[data-mode]:checked')?.value);
    round = pickRound(bank, mode.n);
    idx = 0;
    results = [];
    show('quiz');
    renderQuestion();
  } catch (err) {
    btn.textContent = err.message;
  } finally {
    btn.disabled = false;
    if (btn.textContent.startsWith('Preparing')) btn.textContent = 'Begin the exam';
    renderBest();
  }
}

$('[data-start]').addEventListener('click', start);
$('[data-restart]').addEventListener('click', start);
$('[data-change-mode]').addEventListener('click', () => { renderBest(); show('intro'); });
$('[data-confirm]').addEventListener('click', confirm);
$('[data-next]').addEventListener('click', next);
document.addEventListener('keydown', (e) => {
  if (stages.quiz.hidden || e.target.matches('input[type=text], textarea')) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 5 && !locked) {
    const inp = $(`[data-opt="${n - 1}"] input`);
    if (inp) { inp.checked = !inp.checked; inp.dispatchEvent(new Event('change')); }
  } else if (e.key === 'Enter' && !e.target.matches('button, a')) {
    e.preventDefault();
    locked ? next() : confirm();
  }
});
renderBest();
