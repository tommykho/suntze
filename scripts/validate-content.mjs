// Validate content JSON: verse IDs, schema, lengths, Chinese alignment. Prints OK or a list of problems.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const j = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const verses = j('data/verses.en.json');
const zhSrc = j('data/zh-source.json');
const ids = new Set(verses.chapters.flatMap((c) => c.verses.map((v) => v.id)));
const errors = [], warns = [];
const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
const only = process.argv[2]; // optional: "tactics" | "chapters" | "zh"
const files = (dir) => existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((f) => /^ch\d\d\.json$/.test(f)).sort() : [];

if (!only || only === 'chapters') for (const f of files('data/chapters')) {
  const c = j(`data/chapters/${f}`); const at = `chapters/${f}`;
  if (`ch${String(c.n).padStart(2, '0')}.json` !== f) errors.push(`${at}: n mismatch`);
  if (!c.essence || c.essence.length > 90) errors.push(`${at}: essence missing or > 90 chars`);
  if (!c.modern_lens) errors.push(`${at}: modern_lens missing`);
  if (!ids.has(c.key_verse)) errors.push(`${at}: key_verse ${c.key_verse} unknown`);
  if (!Array.isArray(c.principles) || c.principles.length < 3 || c.principles.length > 5) errors.push(`${at}: principles must be 3–5`);
  for (const p of c.principles || []) {
    for (const v of p.verses || []) if (!ids.has(v)) errors.push(`${at}: principle "${p.name}" verse ${v} unknown`);
    if ((p.gloss || '').length > 160) warns.push(`${at}: gloss > 160 chars (${p.name})`);
  }
}

const DOMAINS = ['work', 'career', 'business', 'personal', 'family', 'self'];
const slugs = new Map();
if (!only || only === 'tactics') for (const f of files('data/tactics')) {
  const arr = j(`data/tactics/${f}`);
  if (!Array.isArray(arr)) { errors.push(`tactics/${f}: not an array`); continue; }
  for (const t of arr) {
    const at = `tactics/${f}:${t.slug}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug || '') || t.slug.length > 40) errors.push(`${at}: bad slug`);
    if (slugs.has(t.slug)) errors.push(`${at}: duplicate slug (also in ${slugs.get(t.slug)})`); else slugs.set(t.slug, f);
    if (!t.title || words(t.title) > 6) errors.push(`${at}: title missing or > 6 words`);
    if (!t.situation || t.situation.length > 140) errors.push(`${at}: situation missing or > 140 chars`);
    if (!DOMAINS.includes(t.domain)) errors.push(`${at}: domain "${t.domain}" invalid`);
    if (!Array.isArray(t.tags) || t.tags.length < 3 || t.tags.length > 6) errors.push(`${at}: tags must be 3–6`);
    if (`ch${String(t.chapter).padStart(2, '0')}.json` !== f) errors.push(`${at}: chapter ${t.chapter} does not match file`);
    if (!Array.isArray(t.verses) || t.verses.length < 1 || t.verses.length > 3) errors.push(`${at}: verses must be 1–3`);
    for (const v of t.verses || []) if (!ids.has(v)) errors.push(`${at}: verse ${v} unknown`);
    if (!(t.verses || []).some((v) => v.startsWith(`${t.chapter}.`))) errors.push(`${at}: needs a verse from its own chapter`);
    const sw = words(t.scene); if (sw < 55 || sw > 150) warns.push(`${at}: scene ${sw} words`);
    if (!Array.isArray(t.moves) || t.moves.length < 3 || t.moves.length > 5) errors.push(`${at}: moves must be 3–5`);
    for (const m of t.moves || []) { if (!m.title || !m.detail) errors.push(`${at}: move missing title/detail`); else if (words(m.detail) > 75) warns.push(`${at}: move detail ${words(m.detail)} words`); }
    if (!t.script || !t.script.label || !t.script.text) errors.push(`${at}: script missing`);
    if (!t.backfire) errors.push(`${at}: backfire missing`);
    if (!t.signals) errors.push(`${at}: signals missing`);
    if (!['minutes', 'hours', 'days'].includes(t.effort)) errors.push(`${at}: effort invalid`);
    if (![1, 2, 3].includes(t.difficulty)) errors.push(`${at}: difficulty invalid`);
    if (/["“”]/.test(t.title)) warns.push(`${at}: quotes in title`);
  }
}

if (!only || only === 'zh') for (const f of files('data/zh')) {
  const z = j(`data/zh/${f}`); const at = `zh/${f}`;
  const src = zhSrc.chapters[z.n - 1].paragraphs.join('');
  const chVerses = verses.chapters[z.n - 1].verses.map((v) => v.id);
  const segIds = (z.segments || []).map((s) => s.id);
  if (segIds.join() !== chVerses.join()) errors.push(`${at}: segment ids must equal verse ids in order (got ${segIds.length}, need ${chVerses.length})`);
  let pos = 0, covered = 0;
  for (const s of z.segments || []) {
    if (!s.zh) continue;
    const k = src.indexOf(s.zh, pos);
    if (k < 0) { errors.push(`${at}: ${s.id} not found in source after previous segment: "${s.zh.slice(0, 20)}…"`); continue; }
    if (k - pos > 0) warns.push(`${at}: gap of ${k - pos} chars before ${s.id}: "${src.slice(pos, k).slice(0, 30)}"`);
    covered += s.zh.length; pos = k + s.zh.length;
  }
  if (pos < src.length) warns.push(`${at}: ${src.length - pos} trailing chars unassigned`);
  const cov = covered / src.length;
  if (cov < 0.95) errors.push(`${at}: coverage ${(cov * 100).toFixed(1)}% (< 95%)`);
  else if (cov < 0.999) warns.push(`${at}: coverage ${(cov * 100).toFixed(1)}%`);
}

// ---------- Field Challenge questions ----------
const tacticSlugs = new Set(files('data/tactics').flatMap((f) => j(`data/tactics/${f}`).map((t) => t.slug)));
const challengeFiles = existsSync(join(root, 'data/challenge')) ? readdirSync(join(root, 'data/challenge')).filter((f) => /^set\d+\.json$/.test(f)).sort() : [];
const qids = new Map();
if (!only || only === 'challenge') for (const f of challengeFiles) {
  let arr;
  try { arr = j(`data/challenge/${f}`); } catch (e) { errors.push(`challenge/${f}: invalid JSON (${e.message})`); continue; }
  if (!Array.isArray(arr)) { errors.push(`challenge/${f}: not an array`); continue; }
  for (const q of arr) {
    const at = `challenge/${f}:${q.id}`;
    if (!/^c-[a-z0-9]+(-[a-z0-9]+)*$/.test(q.id || '') || q.id.length > 40) errors.push(`${at}: bad id`);
    if (qids.has(q.id)) errors.push(`${at}: duplicate id (also in ${qids.get(q.id)})`); else qids.set(q.id, f);
    if (!Number.isInteger(q.chapter) || q.chapter < 1 || q.chapter > 13) errors.push(`${at}: chapter invalid`);
    if (!DOMAINS.includes(q.domain)) errors.push(`${at}: domain "${q.domain}" invalid`);
    if (![1, 2, 3].includes(q.difficulty)) errors.push(`${at}: difficulty invalid`);
    if (!q.title || words(q.title) > 6) errors.push(`${at}: title missing or > 6 words`);
    const sw = words(q.scenario); if (sw < 40 || sw > 130) errors.push(`${at}: scenario ${sw} words (40–130)`);
    if (!Array.isArray(q.options) || q.options.length !== 5) { errors.push(`${at}: needs exactly 5 options`); continue; }
    const nCorrect = q.options.filter((o) => o.correct === true).length;
    if (nCorrect < 1 || nCorrect > 3) errors.push(`${at}: ${nCorrect} correct options (need 1–3)`);
    for (const o of q.options) {
      if (!o.text || typeof o.correct !== 'boolean' || !o.why) errors.push(`${at}: option missing text/correct/why`);
      else {
        if (words(o.text) > 26) warns.push(`${at}: option text ${words(o.text)} words`);
        if (words(o.why) > 45) warns.push(`${at}: why ${words(o.why)} words`);
        if (/all of the above|none of the above/i.test(o.text)) errors.push(`${at}: "all/none of the above" not allowed`);
      }
    }
    if (!Array.isArray(q.verses) || q.verses.length < 1 || q.verses.length > 2) errors.push(`${at}: verses must be 1–2`);
    for (const v of q.verses || []) if (!ids.has(v)) errors.push(`${at}: verse ${v} unknown`);
    if (!(q.verses || []).some((v) => v.startsWith(`${q.chapter}.`))) errors.push(`${at}: needs a verse from its own chapter`);
    if (q.tactic && !tacticSlugs.has(q.tactic)) errors.push(`${at}: tactic "${q.tactic}" unknown`);
    if (!q.lesson || q.lesson.length > 160) errors.push(`${at}: lesson missing or > 160 chars`);
  }
}

for (const w of warns) console.log('warn  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(errors.length ? `${errors.length} error(s)` : 'OK');
process.exit(errors.length ? 1 : 0);
