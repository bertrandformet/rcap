// fetch.js — RCap RSS fetcher pour GitHub Actions
// Usage : node scripts/fetch.js
// Variables d'environnement requises :
//   SUPABASE_URL          (ex. https://xxx.supabase.co)
//   SUPABASE_SERVICE_KEY  (clé service_role, dans les secrets GitHub)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rmoptpqbcmqxtijuaxbr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('ERREUR : variable SUPABASE_SERVICE_KEY manquante');
  process.exit(1);
}

// ─────────────────────────────────────────────
// Helpers Supabase REST
// ─────────────────────────────────────────────
async function sb(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const prefer = options.prefer || 'return=minimal';
  const res = await fetch(url, {
    method: options.method || 'GET',
    body: options.body,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': prefer,
    },
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status} on ${path}: ${body}`);
  }
  if (res.status === 204 || res.status === 201 || options.method === 'POST') return [];
  return res.json().catch(() => []);
}

// ─────────────────────────────────────────────
// Parser RSS/Atom minimal (sans dependance npm)
// ─────────────────────────────────────────────
function extractTag(xml, tag) {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'i');
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
  const m = xml.match(cdataRe) || xml.match(plainRe);
  return m ? m[1].trim() : null;
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function parseItems(xml) {
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  const items = [];
  let m;
  while ((m = itemRe.exec(xml)) !== null) items.push(parseItem(m[1], 'rss'));
  if (items.length === 0) {
    while ((m = entryRe.exec(xml)) !== null) items.push(parseItem(m[1], 'atom'));
  }
  return items;
}

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseItem(chunk, format) {
  let title = cleanText(extractTag(chunk, 'title')) || '(sans titre)';
  let url   = null;
  let desc  = cleanText(extractTag(chunk, 'description') || extractTag(chunk, 'summary') || extractTag(chunk, 'content') || '').slice(0, 500);
  let pubDate = null;

  if (format === 'rss') {
    url = extractTag(chunk, 'link') || extractAttr(chunk, 'link', 'href');
    const dateStr = extractTag(chunk, 'pubDate') || extractTag(chunk, 'dc:date') || extractTag(chunk, 'published');
    if (dateStr) { try { pubDate = new Date(dateStr).toISOString(); } catch (_) {} }
  } else {
    url = extractAttr(chunk, 'link', 'href') || extractTag(chunk, 'link');
    const dateStr = extractTag(chunk, 'published') || extractTag(chunk, 'updated');
    if (dateStr) { try { pubDate = new Date(dateStr).toISOString(); } catch (_) {} }
  }

  return { title, url: url ? url.trim() : null, description: desc, published_at: pubDate };
}

// ─────────────────────────────────────────────
// Fetch d'un flux RSS
// ─────────────────────────────────────────────
async function fetchFeed(feedUrl) {
  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'RCap/1.0 RSS Reader' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseItems(text);
  } catch (err) {
    console.warn(`  [WARN] ${feedUrl} : ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log(`RCap fetch.js — ${new Date().toISOString()}`);

  // 1. Recuperer tous les feeds
  const feeds = await sb('feeds?select=id,url,watchlist_id');
  console.log(`${feeds.length} flux a traiter`);
  if (feeds.length === 0) { console.log('Aucun flux configure.'); return; }

  // 2. Recuperer les URLs deja en base
  const existing = await sb('articles?select=url');
  const existingUrls = new Set(existing.map(a => a.url));
  console.log(`${existingUrls.size} articles deja en base`);

  let totalNew = 0;
  let totalErrors = 0;

  // 3. Traiter chaque flux
  for (const feed of feeds) {
    process.stdout.write(`  ${feed.url} ... `);
    const items = await fetchFeed(feed.url);

    const newItems = items
      .filter(item => item.url && !existingUrls.has(item.url))
      .map(item => ({
        watchlist_id: feed.watchlist_id,
        feed_id:      feed.id,
        title:        item.title,
        url:          item.url,
        description:  item.description,
        published_at: item.published_at,
      }));

    if (newItems.length === 0) { console.log('0 nouveau'); continue; }

    // Inserer par lots de 50
    const batchSize = 50;
    let batchErrors = 0;
    for (let i = 0; i < newItems.length; i += batchSize) {
      const batch = newItems.slice(i, i + batchSize);
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal,resolution=ignore-duplicates',
          },
          body: JSON.stringify(batch),
        });
        batch.forEach(a => existingUrls.add(a.url));
      } catch (err) {
        batchErrors++;
        console.warn(`\n    [ERREUR batch] ${err.message}`);
      }
    }

    if (batchErrors > 0) {
      totalErrors++;
      console.log(`${newItems.length} nouveaux (${batchErrors} erreur(s))`);
    } else {
      console.log(`+${newItems.length} nouveaux`);
    }
    totalNew += newItems.length;
  }

  console.log(`\nTermine : ${totalNew} articles ajoutes, ${totalErrors} flux en erreur.`);
  if (totalErrors > 0) process.exit(1);
}

main().catch(err => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});
