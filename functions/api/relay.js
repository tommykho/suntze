import { handleRelay } from '../../server/relay-core.js';

export const onRequest = (ctx) => handleRelay(ctx.request, ctx.env);
