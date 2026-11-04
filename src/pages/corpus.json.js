// Static JSON consumed by the Field Challenge (retrieval + citation checks). Built at deploy time.
import { corpus } from '../lib/content.js';
export function GET() {
  return new Response(JSON.stringify(corpus()), { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
