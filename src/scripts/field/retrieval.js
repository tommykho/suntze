// Local retrieval over the book + tactic library (no network, no key). Feeds the AI a short menu of
// verses it is allowed to cite, and powers the "manual only" answer.
import MiniSearch from 'minisearch';

const STOP = new Set('a an and are as at be been but by can do does for from get got has have he her him his how i if in into is it its just me my of on or our she so than that the their them then there they this to too up us was we were what when which who why will with would you your about after again all also am any because before being both could did down each few further had having here hers herself himself itself let more most much myself no nor not now off once only other ought ours ourselves out over own same should some such theirs themselves these those through under until very while whom yours yourself yourselves keep keeps always never every still really'.split(' '));
const processTerm = (t) => { const w = t.toLowerCase(); return w.length < 3 || STOP.has(w) ? null : w; };

let corpusPromise;
export function loadCorpus() {
  corpusPromise ||= fetch('/corpus.json').then((r) => { if (!r.ok) throw new Error('Could not load the book data.'); return r.json(); }).then(build);
  return corpusPromise;
}

function build(corpus) {
  const verseById = new Map(corpus.verses.map((v) => [v.id, v]));
  const tacticBySlug = new Map(corpus.tactics.map((t) => [t.slug, t]));
  const verses = new MiniSearch({ fields: ['en'], storeFields: ['id'], idField: 'id', processTerm });
  verses.addAll(corpus.verses);
  const tactics = new MiniSearch({
    fields: ['title', 'situation', 'tags', 'principle', 'scene', 'moves'],
    storeFields: ['slug'],
    idField: 'slug',
    processTerm,
    extractField: (doc, f) => (Array.isArray(doc[f]) ? doc[f].join(' ') : doc[f]),
  });
  tactics.addAll(corpus.tactics);
  return { corpus, verseById, tacticBySlug, verses, tactics };
}

export function retrieve(db, text, { verses = 8, tactics = 3 } = {}) {
  const opts = { fuzzy: 0.2, prefix: true, combineWith: 'OR' };
  const tHits = db.tactics.search(text, { ...opts, boost: { situation: 3, title: 2, tags: 2 } }).slice(0, tactics).map((h) => db.tacticBySlug.get(h.id));
  const vHits = db.verses.search(text, opts).slice(0, verses).map((h) => h.id);
  const ids = new Set([...tHits.flatMap((t) => t.verses), ...vHits]);
  // one anchor verse per chapter keeps the model's menu broad even when keywords miss
  const anchors = ['1.18', '2.19', '3.2', '3.18', '4.1', '4.15', '5.5', '6.30', '7.3', '8.12', '9.24', '10.31', '11.19', '12.18', '13.4'];
  for (const a of anchors) ids.add(a);
  const verseList = [...ids].map((id) => db.verseById.get(id)).filter(Boolean)
    .sort((a, b) => { const [ac, av] = a.id.split('.').map(Number); const [bc, bv] = b.id.split('.').map(Number); return ac - bc || av - bv; });
  return { tactics: tHits, verses: verseList, topVerses: vHits.map((id) => db.verseById.get(id)) };
}
