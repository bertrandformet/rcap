import { createClient } from '@supabase/supabase-js';
import RSSParser from 'rss-parser';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const parser = new RSSParser();

async function run() {
  console.log('── RCap Fetch démarré ──');

  const { data: feeds, error } = await supabase
    .from('feeds')
    .select('id, url, label, keywords, watchlist_id')
    .eq('active', true);

  if (error) {
    console.error('Erreur lecture feeds :', error.message);
    process.exit(1);
  }

  console.log(`${feeds.length} flux à traiter`);

  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      console.log(`\n→ ${feed.label || feed.url} (${parsed.items.length} items)`);

      for (const item of parsed.items) {
        if (feed.keywords?.length > 0) {
          const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
          const match = feed.keywords.some(kw => text.includes(kw.toLowerCase()));
          if (!match) { skipped++; continue; }
        }

        const { error: upsertErr } = await supabase
          .from('articles')
          .upsert(
            {
              feed_id:      feed.id,
              watchlist_id: feed.watchlist_id,
              guid:         item.guid || item.link,
              title:        item.title?.slice(0, 500),
              description:  item.contentSnippet?.slice(0, 1000),
              url:          item.link,
              published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
            },
            { onConflict: 'feed_id,guid', ignoreDuplicates: true }
          );

        if (upsertErr) { console.error('  ✗', upsertErr.message); errors++; }
        else inserted++;
      }

    } catch (err) {
      console.error(`  ✗ ${feed.label || feed.url} :`, err.message);
      errors++;
    }
  }

  console.log('\n── Résumé ──');
  console.log(`✓ ${inserted} articles insérés`);
  console.log(`○ ${skipped} filtrés`);
  if (errors > 0) console.log(`✗ ${errors} erreurs`);
}

run();
