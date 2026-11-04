// Build-time content loader. Merges the verse dataset (Giles EN + original ZH), chapter lenses and tactics.
// Quotes are never authored by hand: every verse is rendered from data/verses.en.json + data/zh/*.json.
import versesEn from '../../data/verses.en.json';

const zhFiles = import.meta.glob('../../data/zh/ch*.json', { eager: true, import: 'default' });
const chapterFiles = import.meta.glob('../../data/chapters/ch*.json', { eager: true, import: 'default' });
const tacticFiles = import.meta.glob('../../data/tactics/ch*.json', { eager: true, import: 'default' });

const zhById = new Map();
for (const file of Object.values(zhFiles)) for (const s of file.segments || []) zhById.set(s.id, s.zh || '');

const lensByN = new Map(Object.values(chapterFiles).map((c) => [c.n, c]));

export const DOMAINS = {
  work: { label: 'Work', zh: '職場' },
  career: { label: 'Career', zh: '前程' },
  business: { label: 'Business', zh: '商戰' },
  personal: { label: 'Personal', zh: '人際' },
  family: { label: 'Family', zh: '家庭' },
  self: { label: 'Self', zh: '修身' },
};

export const tactics = Object.values(tacticFiles)
  .flat()
  .sort((a, b) => a.chapter - b.chapter || Number(!!b.featured) - Number(!!a.featured));

export const chapters = versesEn.chapters.map((c) => {
  const lens = lensByN.get(c.n) || {};
  return {
    n: c.n,
    roman: c.roman,
    title_en: c.title_en,
    title_zh: c.title_zh,
    essence: lens.essence || '',
    modern_lens: lens.modern_lens || '',
    key_verse: lens.key_verse || `${c.n}.1`,
    principles: lens.principles || [],
    verses: c.verses.map((v) => ({ ...v, ch: c.n, zh: zhById.get(v.id) || '' })),
    tactics: tactics.filter((t) => t.chapter === c.n),
  };
});

export const verseMap = new Map(chapters.flatMap((c) => c.verses.map((v) => [v.id, v])));
export const getVerse = (id) => verseMap.get(id);
export const chapterOf = (n) => chapters[n - 1];

export const ZH_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三'];
export const verseHref = (id) => {
  const [ch] = id.split('.');
  return `/chapters/${ch}/#v${id.replace('.', '-')}`;
};

export function relatedTactics(t, limit = 3) {
  const score = (o) => (o.domain === t.domain ? 2 : 0) + (o.chapter === t.chapter ? 1 : 0) + o.tags.filter((x) => t.tags.includes(x)).length;
  return tactics
    .filter((o) => o.slug !== t.slug)
    .map((o) => [score(o), o])
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, o]) => o);
}

export const featured = tactics.filter((t) => t.featured);

// Compact corpus shipped to the browser for retrieval and citation checking.
export function corpus() {
  return {
    v: 1,
    chapters: chapters.map((c) => ({ n: c.n, en: c.title_en, zh: c.title_zh, essence: c.essence })),
    verses: chapters.flatMap((c) => c.verses.map((v) => ({ id: v.id, l: v.label, en: v.en, zh: v.zh }))),
    tactics: tactics.map((t) => ({
      slug: t.slug,
      title: t.title,
      situation: t.situation,
      domain: t.domain,
      tags: t.tags,
      chapter: t.chapter,
      principle: t.principle,
      verses: t.verses,
      moves: t.moves.map((m) => m.title),
      scene: t.scene,
      script: t.script,
      backfire: t.backfire,
    })),
  };
}
