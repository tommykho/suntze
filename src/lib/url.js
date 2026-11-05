// Base-path aware URLs, so the same build works at a domain root (Cloudflare, Vercel) and under a
// sub-path (GitHub Pages project site: /suntze/). Works in Astro pages and in client bundles.
const env = import.meta.env || {}; // undefined when run directly by Node (tests, scripts)
export const BASE = (env.BASE_URL || '/').replace(/\/+$/, '');
export const u = (path) => `${BASE}${path}`;
// Relay endpoint: same-origin by default; a static host without functions (GitHub Pages) can point
// PUBLIC_RELAY_URL at a relay deployed elsewhere (e.g. Vercel / Cloudflare / NAS).
export const RELAY_URL = env.PUBLIC_RELAY_URL || `${BASE}/api/relay`;
