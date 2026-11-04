import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './src/site.config.js';

// Static build for Cloudflare Pages. /functions (relay) is deployed by Pages alongside dist/.
export default defineConfig({
  site: process.env.SITE_URL || SITE.url,
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'never' },
  vite: {
    // Keep scripts as external files so the CSP can forbid inline scripts.
    build: { assetsInlineLimit: 0 },
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['kokoro-js', '@huggingface/transformers'] },
  },
});
