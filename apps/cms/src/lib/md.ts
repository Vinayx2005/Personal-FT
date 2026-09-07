// Copy of apps/root/src/lib/md.ts — kept per-app on purpose (see the note
// in the workspace README about not building shared packages until the
// 3rd consumer of them shows up).
export function renderMarkdown(md: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const renderInline = (s: string) => {
    let x = escapeHtml(s);
    x = x.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" />');
    x = x.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
    x = x.replace(/`([^`]+)`/g, '<code>$1</code>');
    x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    x = x.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return x;
  };
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++; out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`); continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) { out.push(`<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^-{3,}$|^\*{3,}$/.test(line.trim())) { out.push('<hr />'); i++; continue; }
    if (line.startsWith('> ')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++; }
      out.push(`<blockquote>${renderInline(buf.join(' '))}</blockquote>`); continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^[-*]\s+/, ''))}</li>`); i++;
      }
      out.push(`<ul>${items.join('')}</ul>`); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`); i++;
      }
      out.push(`<ol>${items.join('')}</ol>`); continue;
    }
    if (line.trim() === '') { i++; continue; }
    const buf: string[] = [line]; i++;
    while (
      i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') &&
      !/^#{1,3}\s+/.test(lines[i]) && !/^-{3,}$|^\*{3,}$/.test(lines[i].trim()) &&
      !lines[i].startsWith('> ') && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    out.push(`<p>${renderInline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}
