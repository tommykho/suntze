// Minimal, safe markdown renderer (escape first, then a small whitelist of formatting).
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s, verseById) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|\s)_([^_]+?)_(?=\s|$|[.,;:!?])/g, '$1<em>$2</em>')
    .replace(/\[(\d{1,2})\.(\d{1,2})\]/g, (m, c, v) => {
      const id = `${c}.${v}`;
      const ok = verseById?.has(id);
      return ok
        ? `<button type="button" class="cite" data-cite="${id}" title="Show verse ${id}">${id}</button>`
        : `<span class="cite cite--bad" title="Not a verse in the book">${id}?</span>`;
    });
}

export function renderMarkdown(md, verseById) {
  const lines = md.replace(/\r/g, '').split('\n');
  let html = '';
  let list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { close(); continue; }
    if ((m = line.match(/^#{1,4}\s+(.*)$/))) {
      close();
      const title = m[1].replace(/[*#]/g, '').trim();
      html += `<h3 class="ans-h" data-section="${esc(title)}">${esc(title)}</h3>`;
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; }
      html += `<li>${inline(m[1], verseById)}</li>`;
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; }
      html += `<li>${inline(m[1], verseById)}</li>`;
    } else {
      close();
      html += `<p>${inline(line, verseById)}</p>`;
    }
  }
  close();
  return html;
}

export { esc };
