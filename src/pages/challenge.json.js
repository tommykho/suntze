// Field Challenge question bank, with verse text (Giles EN + 原文) and tactic titles resolved at build time.
import { getVerse, chapterOf, tactics, ZH_NUMERALS } from '../lib/content.js';

const sets = import.meta.glob('../../data/challenge/set*.json', { eager: true, import: 'default' });
const tacticTitle = new Map(tactics.map((t) => [t.slug, t.title]));

export function GET() {
  const questions = Object.values(sets)
    .flat()
    .map((q) => {
      const ch = chapterOf(q.chapter);
      return {
        id: q.id,
        chapter: q.chapter,
        chapterTitle: ch.title_en,
        chapterZh: ch.title_zh,
        chapterNumeral: ZH_NUMERALS[q.chapter - 1],
        roman: ch.roman,
        domain: q.domain,
        difficulty: q.difficulty,
        title: q.title,
        scenario: q.scenario,
        options: q.options.map((o) => ({ text: o.text, correct: o.correct, why: o.why })),
        verses: q.verses.map((id) => { const v = getVerse(id); return { id, label: `${v.ch}.${v.label}`, en: v.en, zh: v.zh }; }),
        tactic: q.tactic && tacticTitle.has(q.tactic) ? { slug: q.tactic, title: tacticTitle.get(q.tactic) } : null,
        lesson: q.lesson,
      };
    })
    .sort((a, b) => a.chapter - b.chapter);
  return new Response(JSON.stringify({ v: 1, count: questions.length, questions }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
