import { BASE as B } from '../lib/url.js';
// Community board — preview mode. Demo reports ship with the site; reports and ratings a visitor adds
// are stored in this browser only. Phase 2 swaps `store` for the Cloudflare D1 API (see docs/ROADMAP.md).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const { demo, tactics, domains } = JSON.parse($('[data-community-payload]').dataset.json);
const tacticTitle = new Map(tactics.map((t) => [t.slug, t.title]));

const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const store = {
  get: (k, fb) => safe(() => JSON.parse(localStorage.getItem(k)) ?? fb, fb),
  set: (k, v) => safe(() => localStorage.setItem(k, JSON.stringify(v))),
};
const K = { posts: 'sz.community.posts', votes: 'sz.community.votes', flags: 'sz.community.flags', alias: 'sz.community.alias' };

let mine = store.get(K.posts, []);
let votes = store.get(K.votes, {});
let flags = store.get(K.flags, {});
let domain = '';

// ---------- privacy masking ----------
export function mask(text) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email removed]')
    .replace(/\bhttps?:\/\/\S+/gi, '[link removed]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[number removed]');
}

// ---------- rendering ----------
const score = (p) => {
  const mineVote = votes[p.id];
  const votesN = (p.votes || 0) + (mineVote ? 1 : 0);
  const sum = (p.rating || 0) * (p.votes || 0) + (mineVote || 0);
  return { avg: votesN ? sum / votesN : 0, n: votesN, mineVote };
};

function postHtml(p) {
  const s = score(p);
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<button type="button" class="${n <= Math.round(s.mineVote || s.avg) ? 'on' : ''}" data-rate="${n}" data-id="${esc(p.id)}" aria-label="Rate ${n} of 5">★</button>`)
    .join('');
  const verses = (p.verses || []).map((v) => `<a class="chip" href="${B}/chapters/${esc(v.split('.')[0])}/#v${esc(v.replace('.', '-'))}">Verse ${esc(v)}</a>`).join(' ');
  const tac = p.tacticSlug && tacticTitle.has(p.tacticSlug) ? `<a class="chip chip--seal" href="${B}/tactics/${esc(p.tacticSlug)}/">${esc(tacticTitle.get(p.tacticSlug))}</a>` : '';
  return `<article class="post ${p.mine ? 'mine' : ''}" data-reveal-off>
    <div class="avatar" aria-hidden="true">${esc((p.alias || '?').trim()[0])}</div>
    <div>
      <div class="who"><strong>${esc(p.alias)}</strong> · ${esc(domains[p.domain]?.label || p.domain)} · ${esc(p.date)}${p.mine ? ' · <em>only visible to you (preview)</em>' : ''}</div>
      <h3>${esc(p.title)}</h3>
      <span class="lbl">Situation</span><p>${esc(p.situation)}</p>
      <span class="lbl">What they did</span><p>${esc(p.tactic)}</p>
      ${p.outcome ? `<span class="lbl">Outcome</span><p>${esc(p.outcome)}</p>` : ''}
      <div class="card-meta" style="margin-top:12px">${tac} ${verses}</div>
      <div class="post-foot">
        <span><span class="stars" role="group" aria-label="Rate this report">${stars}</span> <span class="score">${s.n ? `${s.avg.toFixed(1)} · ${s.n} rating${s.n === 1 ? '' : 's'}` : 'No ratings yet'}${s.mineVote ? ' · you rated ' + s.mineVote : ''}</span></span>
        <span>${p.mine ? `<button class="flag" type="button" data-delete="${esc(p.id)}">Delete</button>` : `<button class="flag" type="button" data-flag="${esc(p.id)}">Flag as reckless or unsafe</button>`}</span>
      </div>
    </div>
  </article>`;
}

function render() {
  const q = $('[data-cq]').value.toLowerCase().trim();
  const sort = $('[data-csort]').value;
  const all = [...mine.map((p) => ({ ...p, mine: true })), ...demo].filter((p) => !flags[p.id]);
  const list = all
    .filter((p) => !domain || p.domain === domain)
    .filter((p) => !q || `${p.title} ${p.situation} ${p.tactic} ${p.outcome}`.toLowerCase().includes(q))
    .sort((a, b) => (sort === 'new' ? b.date.localeCompare(a.date) : sort === 'votes' ? score(b).n - score(a).n : score(b).avg - score(a).avg));
  $('[data-posts]').innerHTML = list.length ? list.map(postHtml).join('') : '<p class="hint">No field reports match. Be the first to post one.</p>';
  $$('[data-cdomain]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cdomain === domain)));
  window.dispatchEvent(new Event('resize'));
}

document.addEventListener('click', (e) => {
  const rate = e.target.closest('[data-rate]');
  if (rate) { votes[rate.dataset.id] = Number(rate.dataset.rate); store.set(K.votes, votes); render(); return; }
  const flag = e.target.closest('[data-flag]');
  if (flag && confirm('Flag this report as reckless or unsafe? It will be hidden for you and sent to moderators once accounts launch.')) {
    flags[flag.dataset.flag] = true; store.set(K.flags, flags); render(); return;
  }
  const del = e.target.closest('[data-delete]');
  if (del && confirm('Delete your report from this browser?')) { mine = mine.filter((p) => p.id !== del.dataset.delete); store.set(K.posts, mine); render(); }
});
$('[data-cq]').addEventListener('input', render);
$('[data-csort]').addEventListener('change', render);
$$('[data-cdomain]').forEach((b) => b.addEventListener('click', () => { domain = b.dataset.cdomain; render(); }));

// ---------- new report ----------
const ADJ = ['Quiet', 'Patient', 'Still', 'Iron', 'Hidden', 'Calm', 'Swift', 'Silver', 'Misty', 'Steady'];
const NOUN = ['Crane', 'River', 'Pine', 'Bamboo', 'Harbor', 'Tide', 'Heron', 'Lantern', 'Ridge', 'Willow'];
const alias = store.get(K.alias, null) || `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]} ${Math.floor(Math.random() * 90 + 10)}`;
$('[data-alias]').value = alias;
$('[data-nslug]').insertAdjacentHTML('beforeend', tactics.map((t) => `<option value="${esc(t.slug)}">${esc(t.title)}</option>`).join(''));

const draft = store.get('sz.community.draft', null);
if (draft) {
  $('[data-nsit]').value = draft.situation || '';
  $('[data-ntac]').value = draft.tactic || '';
  $('[data-nverses]').value = (draft.verses || []).join(', ');
  safe(() => localStorage.removeItem('sz.community.draft'));
  $('[data-nstatus]').textContent = 'Draft imported from the Field Challenge. Edit it before posting.';
}

$('[data-new]').addEventListener('submit', (e) => {
  e.preventDefault();
  const verses = $('[data-nverses]').value.split(/[\s,;]+/).filter((v) => /^\d{1,2}\.\d{1,2}$/.test(v)).slice(0, 5);
  const p = {
    id: `mine-${Date.now()}`,
    alias: mask($('[data-alias]').value.trim()).slice(0, 32) || alias,
    domain: $('[data-ndomain]').value,
    title: mask($('[data-ntitle]').value.trim()),
    situation: mask($('[data-nsit]').value.trim()),
    tactic: mask($('[data-ntac]').value.trim()),
    outcome: mask($('[data-nout]').value.trim()),
    tacticSlug: $('[data-nslug]').value,
    verses,
    rating: 0,
    votes: 0,
    date: new Date().toISOString().slice(0, 10),
  };
  mine.unshift(p);
  store.set(K.posts, mine);
  store.set(K.alias, p.alias);
  e.target.reset();
  $('[data-alias]').value = p.alias;
  $('[data-nstatus]').textContent = 'Posted (saved in this browser).';
  render();
  document.querySelector('[data-posts]').scrollIntoView({ behavior: 'smooth' });
});

render();
