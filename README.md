# Sun Tzu · Modern Field Manual 孫子兵法

*The Art of War, for the battles you actually fight.*

A static website that turns Sun Tzu's 13 chapters (Giles 1910 + original Chinese) into practical tactics for work,
career, business, family and self. It includes:

- **The book**: a scroll-animated, ink-wash edition with 383 numbered verses, each in English and 原文 side by side.
- **Tactic library**: 52 tactics. Each has a scene, verse citations, moves, a ready-to-send script, a backfire check and signs that it is working.
- **Field Challenge (AI)**: describe your situation and get a plan. Every verse citation is checked against the dataset: exact quotes, paraphrases and invented IDs are labelled.
- **30-second podcast**: the plan becomes a spoken script, voiced on your device (Kokoro-82M) or with your own TTS key, and downloaded as an MP3.
- **Community board** (preview): post a field report, rate others' reports, flag reckless ones. Phase 2 adds accounts and shared storage.

**Cost to the site owner: $0.** The site is static. AI and voice run on the visitor's device or on the visitor's own
provider key. The only server code is a small stateless CORS relay, which runs within Cloudflare's free quota.

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # validates content, then builds to dist/
npm test           # relay unit tests
```

Node 20+ is required.

## AI providers (bring your own key)

| Provider | Cost to visitor | Route |
|---|---|---|
| Puter.js | free, no key (Puter sign-in) | browser |
| WebLLM on-device | free, no key, about a 2 GB download | browser (WebGPU) |
| OpenRouter `:free` models | free key | browser |
| Google Gemini | free key | browser (relay fallback) |
| Groq · Mistral · Cerebras · GitHub Models | free keys | browser (relay fallback) |
| NVIDIA NIM | free key | relay (NVIDIA blocks browsers) |
| Anthropic Claude | paid key | browser (official SDK) |
| Meta Muse Spark | paid key (public preview) | relay |
| Custom OpenAI-compatible, e.g. Ollama on your NAS | free | browser |

Podcast voice: Kokoro-82M on the device (default, free) · Gemini TTS · OpenAI TTS · ElevenLabs (visitor's key).

## Project layout

```
data/            sources (public domain), verses.en.json, zh/, chapters/, tactics/, community-demo.json
scripts/         build-verses.mjs (parse sources) · validate-content.mjs (schema + citation checks)
src/pages/       index, chapters/[n], tactics/, tactics/[slug], field, community, about, corpus.json
src/scripts/     motion.js (GSAP + Lenis) · ink.js · field/* (providers, retrieval, prompt, tts, worker) · community.js
server/          relay-core.js (portable) · node-relay.mjs (NAS / self-host)
functions/api/   relay.js (Cloudflare Pages Function)
docs/            ARCHITECTURE · DEPLOY · ROADMAP · CONTENT-GUIDE
```

## Content rules

Content never contains typed Sun Tzu quotes. It references verse IDs, and the site renders the exact text.
See [docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md) and run `npm run validate` after any edit.

## Deploy

Cloudflare Pages + GitHub, free and commercial use allowed. Steps: [docs/DEPLOY.md](docs/DEPLOY.md).

## Licences

Text: public domain (Project Gutenberg #17405 and #23864). Code: add your preferred licence before accepting
contributions. Third-party credits are on the About page.
