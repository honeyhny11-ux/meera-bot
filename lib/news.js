// Google News RSS search — free, no key, no account.

const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '').trim();

export async function findNews(query) {
  if (!query) return null;
  const q = encodeURIComponent(`${query} when:30d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const xml = await res.text();
    const item = xml.match(/<item>([\s\S]*?)<\/item>/)?.[1];
    if (!item) return null;

    const source = tag(item, 'source');
    let headline = tag(item, 'title');
    // Google appends " - Source" to titles; drop it since we show source separately.
    if (source && headline.endsWith(` - ${source}`)) headline = headline.slice(0, -(source.length + 3));

    const pub = new Date(tag(item, 'pubDate'));
    // The description is escaped HTML, so decode a second time after stripping tags.
    let summary = decode(tag(item, 'description').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (summary.startsWith(headline)) summary = ''; // Google often just repeats the headline.

    return {
      headline,
      source: source || 'Unknown source',
      date: isNaN(pub) ? 'Unknown date' : pub.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      link: tag(item, 'link'),
      summary: summary.slice(0, 300),
    };
  } catch {
    return null; // News is a bonus — never block a draft on it.
  }
}
