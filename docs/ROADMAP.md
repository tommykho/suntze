# Roadmap & open decisions

## Shipped (v0.1, static MVP)
- [x] 13 chapters with 383 verses: Giles English and original Chinese, matched verse by verse (100% coverage, machine-checked)
- [x] 13 chapter lenses and 52 tactics, including the three founder cases (control the record, silence is consent, deadline unless advised)
- [x] Ink-wash scroll design: GSAP ScrollTrigger, Lenis, pinned horizontal chapter scroller, ink canvas, brush draws, reduced-motion support
- [x] Field Challenge: 20-scenario skill test (multi-select moves, % scoring, Rural → Empire rank)
- [x] Ask the General: 12 AI options (bring your own key, no key, on device, self-hosted), local retrieval, citation verification, manual-only mode
- [x] 30-second podcast: Kokoro on device plus Gemini/OpenAI/ElevenLabs keys, singing-bowl intro, MP3 download
- [x] Community board preview (stored in the browser), relay with tests, Cloudflare Pages config
- [x] Test deployment: GitHub Pages (built from `main` by GitHub Actions) + relay on Vercel (`suntze-relay.vercel.app`)

## Decisions needed from the owner
1. **Brand name and domain.** “Sun Tzu: The Art of War” is reportedly filed as a trademark for games and software (unverified, so check USPTO). Pick a distinctive name, e.g. *Quiet General*, *Bingfa*, or *Field Manual 兵法*, then update `src/site.config.js`.
2. **Code licence** (MIT or AGPL, for example) before accepting contributions.
3. **Monetisation** (Cloudflare allows commercial use): supporter tier, tactic packs, sponsorships. Avoid ad scripts that weaken the CSP.

## Phase 2: community (next)
- [ ] Cloudflare D1 schema and `/api/posts`, `/api/ratings`, `/api/flags` Pages Functions
- [ ] GitHub and Google sign-in, public alias only
- [ ] Flag threshold auto-hide, admin queue, name masking on the server
- [ ] Turnstile on posting

## Phase 3
- [ ] Full Traditional Chinese interface (繁體中文) and AI answers
- [ ] Daily 30-second episode page plus an RSS feed of generated episodes (visitor-generated, opt-in)
- [ ] Shareable answer cards (image), tactic packs (e.g. “New manager”, “Difficult family”)
- [ ] Optional: reviewing the zh alignment against another edition (e.g. 十一家注)

## Known limits
- Free model names change often (OpenRouter `:free`, Gemini aliases); defaults are editable, and OpenRouter has a "Load free models" button.
- Kokoro first run downloads about 80 MB (q8, WASM). GPU mode is faster but larger.
- WebLLM needs WebGPU (desktop Chrome or Edge).
- The Gemini TTS model name is a preview name. It is editable in Settings.
