# Content Guide — tactics, chapter lenses, Chinese alignment

All content is JSON in `data/`. Run `node scripts/validate-content.mjs` after every change; it must print `OK`.

**Golden rule: never type a Sun Tzu quote.** Content refers to verses by ID (`"3.18"`). The site renders
the exact Giles (1910) English and the original Chinese from `data/verses.en.json` + `data/zh/`.
That is how we guarantee no invented quotes.

Verse IDs are `chapter.verse` using Giles's numbering. Combined verses use the first number
(Giles "5,6." in chapter 1 → `1.5`). The full list is in `data/verses.en.json`.

---

## 1. Chapter lens — `data/chapters/chNN.json` (NN = 01..13)

```json
{
  "n": 1,
  "essence": "Win on paper before you fight in person.",
  "modern_lens": "2–3 sentences: what this chapter means for a modern professional/personal life.",
  "key_verse": "1.18",
  "principles": [
    { "name": "The Five Factors", "verses": ["1.3", "1.4"], "gloss": "One sentence, modern meaning." }
  ]
}
```
- `essence` ≤ 90 characters, punchy, no quote marks.
- `principles`: 3–5 items; `name` ≤ 5 words; `gloss` ≤ 160 characters; verses from this chapter.

## 2. Tactics — `data/tactics/chNN.json` (array, 4 per chapter unless told otherwise)

```json
[
  {
    "slug": "control-the-record",
    "title": "Control the Record",
    "situation": "A coworker deflects blame and turns every discussion into a shouting match.",
    "domain": "work",
    "tags": ["blame", "coworker", "documentation"],
    "chapter": 4,
    "principle": "Make yourself invincible first",
    "verses": ["4.1", "4.15"],
    "scene": "Picture this: ... (70–120 words)",
    "moves": [
      { "title": "Document every detail", "detail": "25–60 words of concrete action." }
    ],
    "script": { "label": "Follow-up email", "text": "Ready-to-send text with [placeholders]." },
    "backfire": "When NOT to use this, risks, ethical line (30–70 words).",
    "signals": "How you know it is working (15–40 words).",
    "effort": "minutes",
    "difficulty": 1,
    "featured": false
  }
]
```

Field rules
- `slug`: kebab-case, unique across the whole site, ≤ 40 chars.
- `title`: ≤ 6 words, memorable, imperative or evocative ("Silence Is Consent", "Borrow the Enemy's Grain").
- `situation`: one line, ≤ 120 chars, the everyday problem in plain words.
- `domain`: one of `work`, `career`, `business`, `personal`, `family`, `self`.
- `tags`: 3–6 lowercase words.
- `verses`: 1–3 IDs that exist; at least one from the tactic's own `chapter`.
- `scene`: 70–120 words, second person, present tense, vivid and concrete, opens with a hook
  ("Picture this:" or similar — vary it), ends with a punchy one-line lesson.
- `moves`: 3–5 steps. Each `title` ≤ 6 words; each `detail` 25–60 words of specific, doable actions.
- `script`: a ready-to-use email / chat message / spoken line, 40–110 words, `[placeholders]` in brackets.
- `backfire`: always honest. Say when the tactic fails or is unethical. No manipulation that harms,
  no lying, no harassment, no illegal surveillance, no retaliation against protected activity.
- `effort`: `minutes` | `hours` | `days`.  `difficulty`: 1 (easy) – 3 (advanced).
- `featured`: `true` only for the three founder examples.

Tone
- Calm, strategic, practical. Sun Tzu as a coach, not a warlord. Win without fighting.
- Modern and specific (Slack, Jira, email, 1:1s, landlords, group chats, in-laws, budgets).
- Plain English. No clichés like "in today's fast-paced world". No emojis.

Domain mix per batch: ≥ 40% `work`/`career`, ≥ 25% `personal`/`family`/`self`, the rest `business`.

## 3. Chinese alignment — `data/zh/chNN.json`

```json
{ "n": 1, "segments": [ { "id": "1.1", "zh": "孫子曰：兵者，國之大事，" } ] }
```
- One entry per Giles verse ID of that chapter, in order.
- `zh` must be copied **exactly** from `data/zh-source.json` (chapter paragraphs joined with no separator).
  Do not modernise, simplify, re-punctuate or add characters. Segments appear in source order and do
  not overlap.
- If a verse has no Chinese counterpart, use `""`. Validator reports coverage; target ≥ 95%.
