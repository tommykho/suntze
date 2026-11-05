# Architecture

```
            ┌──────────────────────── Cloudflare Pages (static, free) ───────────────────────┐
 Visitor ──▶│  HTML/CSS/JS · /corpus.json (verses + tactics) · Kokoro worker + WASM (lazy)    │
 browser    │  /api/relay  ← Pages Function: stateless, allowlisted, streams, never stores    │
            └────────────────────────────────────────────────────────────────────────────────┘
   │  key stays in browser storage (session by default)
   ├──▶ OpenRouter / Gemini / Groq / Mistral / Cerebras / GitHub Models   (direct; relay if CORS blocked)
   ├──▶ Anthropic (official SDK, direct browser access)                   (direct)
   ├──▶ NVIDIA NIM / Meta Muse ──▶ /api/relay ──▶ provider                 (relay)
   ├──▶ Puter.js (no key) · WebLLM (on device) · Custom (e.g. NAS Ollama)
   └──▶ TTS: Kokoro-82M on device (default) · Gemini / OpenAI / ElevenLabs with the visitor's key → MP3 (lamejs)
```

## Ask the General pipeline

1. **Retrieve (local):** MiniSearch over 383 verses and 52 tactics → top tactics, their verses, keyword-matched verses, plus one anchor verse per chapter (about 25–30 verses).
2. **Prompt:** the system prompt sets the stance (win without fighting), the ethics limits, a strict six-section format, and *cite only listed IDs*. The situation is wrapped as data, not instructions.
3. **Stream** the answer and render it with a whitelist markdown renderer (escaped HTML).
4. **Verify:** each `[c.v]` is checked against the dataset; each quoted phrase is checked for an exact match against its verse (EN or 原文). The UI shows *Exact quote*, *Paraphrased* or *Not in the book*, with the full verse text.
5. **Podcast:** the *Podcast Script* section fills the studio → TTS → a synthesized singing-bowl intro and outro → MP3 Blob → download.

## Data pipeline

`npm run data` → `scripts/build-verses.mjs` parses the Gutenberg texts into `data/verses.en.json` and
`data/zh-source.json`. `data/zh/chNN.json` holds the editorial verse alignment. `scripts/validate-content.mjs`
enforces exact-slice Chinese segments, verse-ID validity, schema and length rules. `npm run build` refuses to build when validation fails.

## Security notes

- CSP in `public/_headers`: no inline scripts (Astro is set to emit external scripts only). Scripts may come only from self, Puter, esm.run (WebLLM) and jsDelivr.
- Relay: origin check, https-only allowlisted prefixes, no ports or credentials in URLs, path-traversal check, 100 KB body cap, forwarded-header allowlist, no redirects, no logging. 24 unit tests.
- Community preview: all user text is escaped on render. Emails, URLs and phone numbers are masked before saving.

## Phase 2: community backend (planned)

- Cloudflare D1 tables: `users(id, provider, alias, created)`, `posts(id, user_id, domain, title, situation, tactic, outcome, tactic_slug, verses, status, created)`, `ratings(post_id, user_id, stars)`, `flags(post_id, user_id, reason)`.
- Auth: GitHub and Google OAuth via a Pages Function (for example Better Auth with the D1 adapter). Only the alias is ever public.
- Moderation: automatically hidden after N flags; admin queue. Optional AI pre-screen using the poster's own key.
- `src/scripts/community.js` already isolates storage in `store`; swap it for `fetch('/api/posts')`.
