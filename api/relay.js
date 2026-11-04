// Vercel Function adapter for the BYOK relay (same portable core as the Cloudflare Pages Function).
// Vercel serves this at /api/relay. Env: ALLOWED_ORIGINS (optional, comma-separated).
import { handleRelay } from '../server/relay-core.js';

const env = () => ({ ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '', DEV: process.env.DEV || '' });

export function POST(request) {
  return handleRelay(request, env());
}
export function OPTIONS(request) {
  return handleRelay(request, env());
}
export function GET(request) {
  return handleRelay(request, env()); // 405 JSON
}
