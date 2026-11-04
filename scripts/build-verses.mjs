// Parse the public-domain sources into a clean, numbered verse dataset.
//   Giles 1910 (Project Gutenberg #17405, text only, no commentary)
//   孫子兵法 (Project Gutenberg #23864, Traditional Chinese)
// Output: data/verses.en.json, data/zh-source.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

const ZH_TITLES = ['始計', '作戰', '謀攻', '軍形', '兵勢', '虛實', '軍爭', '九變', '行軍', '地形', '九地', '火攻', '用間'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(By|Of|The|On|And|In)\b/g, (w, _a, i) => (i === 0 ? w : w.toLowerCase()));

// ---------- English (Giles) ----------
const en = read('data/sources/giles-1910-pg17405.txt');
const body = en.slice(en.indexOf('I. LAYING PLANS'), en.indexOf('[END - Sun Tzu on the Art of War'));
const lines = body.split('\n');
const chapters = [];
let ch = null, verse = null;
const headRe = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)\.\s+([A-Z][A-Z ,]+)\s*$/;
const verseRe = /^\s*(\d+(?:\s*,\s*\d+)*)\.\s+(.*)$/;
const flush = () => { if (verse) { verse.en = verse.en.replace(/\s+/g, ' ').trim(); ch.verses.push(verse); verse = null; } };
for (const line of lines) {
  const h = line.match(headRe);
  if (h) {
    flush();
    ch = { n: chapters.length + 1, roman: h[1], title_en: titleCase(h[2].trim()), title_zh: ZH_TITLES[chapters.length], verses: [] };
    chapters.push(ch);
    continue;
  }
  if (!ch) continue;
  const v = line.match(verseRe);
  if (v && !/^\s{5,}/.test(line)) {
    flush();
    const nums = v[1].split(',').map((s) => parseInt(s.trim(), 10));
    verse = { id: `${ch.n}.${nums[0]}`, label: nums.length > 1 ? `${nums[0]}–${nums[nums.length - 1]}` : String(nums[0]), en: v[2] };
    continue;
  }
  if (verse && line.trim()) verse.en += ' ' + line.trim();
}
flush();

// sanity: sequential numbering per chapter
const problems = [];
for (const c of chapters) {
  let expect = 1;
  for (const v of c.verses) {
    const [first, last] = v.label.split('–').map(Number);
    if (first !== expect) problems.push(`${c.n}: expected ${expect} got ${v.label}`);
    expect = (last || first) + 1;
  }
}
if (chapters.length !== 13) throw new Error(`Expected 13 chapters, got ${chapters.length}`);

// ---------- Chinese (孫子兵法) ----------
const zh = read('data/sources/sunzi-bingfa-pg23864.txt');
const zend = Math.min(...['*** END OF', 'End of the Project Gutenberg', 'End of Project Gutenberg'].map((m) => zh.indexOf(m)).filter((i) => i > 0));
const zbody = zh.slice(zh.indexOf('始計第一'), zend);
const zchapters = [];
let cur = null;
for (const raw of zbody.split('\n')) {
  const line = raw.trim();
  if (!line) continue;
  const t = line.match(/^(.{2})第[一二三四五六七八九十]+$/);
  if (t && ZH_TITLES.includes(t[1])) { cur = { n: zchapters.length + 1, title: line, paragraphs: [] }; zchapters.push(cur); continue; }
  if (cur) cur.paragraphs.push(line);
}
if (zchapters.length !== 13) throw new Error(`Expected 13 zh chapters, got ${zchapters.length}`);

writeFileSync(join(root, 'data/verses.en.json'), JSON.stringify({
  source: 'Lionel Giles (1910), Project Gutenberg eBook #17405 — public domain',
  chapters,
}, null, 1) + '\n');
writeFileSync(join(root, 'data/zh-source.json'), JSON.stringify({
  source: '孫子兵法, Project Gutenberg eBook #23864 — public domain',
  chapters: zchapters,
}, null, 1) + '\n');

const total = chapters.reduce((a, c) => a + c.verses.length, 0);
console.log(`EN: ${chapters.length} chapters, ${total} verses`);
for (const c of chapters) console.log(`  ${c.n}. ${c.title_en} (${c.title_zh}) — ${c.verses.length} verses, last ${c.verses.at(-1).label}`);
console.log(`ZH: ${zchapters.map((c) => c.paragraphs.join('').length).join(', ')} chars per chapter`);
if (problems.length) { console.log('Numbering notes:'); problems.forEach((p) => console.log('  ' + p)); }
