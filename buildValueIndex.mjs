// Build cardValues.json from TCGdex pricing.
//
// TCGdex embeds pricing in each card's DETAIL response only (not the bulk
// list), so we fetch every card's price once and collapse it into one small
// file the Pokemon-card-scanner app downloads and sorts/displays from.
//
// Run by the monthly GitHub Action (.github/workflows/build-values.yml), or
// locally with:  node buildValueIndex.mjs
//
// Output: cardValues.json
//   { "generatedAt": "<ISO>", "count": N, "values": { "<cardId>": <usd> } }

import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const BASE = 'https://api.tcgdex.net/v2/en';
const CONCURRENCY = 40;
const EUR_TO_USD = 1.08; // rough; only affects sort ordering, not display
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'cardValues.json');

async function getJson(url) {
  const res = await fetch(url, {headers: {Accept: 'application/json'}});
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const round = n => Math.round(n * 100) / 100;

// One representative USD value per card. Prefer TCGplayer market (USD), then
// CardMarket trend/avg (EUR → USD).
function repValueUsd(pricing) {
  if (!pricing) return null;
  const tp = pricing.tcgplayer;
  if (tp) {
    for (const variant of ['holo', 'normal', 'reverse', 'firstEdition']) {
      const m = tp[variant]?.marketPrice;
      if (typeof m === 'number' && m > 0) return round(m);
    }
  }
  const cm = pricing.cardmarket;
  if (cm) {
    const eur = cm.trend ?? cm.avg ?? cm['avg7'] ?? cm['avg30'];
    if (typeof eur === 'number' && eur > 0) return round(eur * EUR_TO_USD);
  }
  return null;
}

async function run() {
  console.log('Fetching full card list…');
  const briefs = await getJson(`${BASE}/cards`);
  const ids = briefs.map(b => b.id);
  console.log(`  ${ids.length} cards`);

  const values = {};
  let cursor = 0;
  let done = 0;
  let withPrice = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const card = await getJson(`${BASE}/cards/${encodeURIComponent(id)}`);
        const v = repValueUsd(card.pricing);
        if (v != null) {
          values[id] = v;
          withPrice++;
        }
      } catch {
        // skip cards that fail; they just won't have a value
      }
      if (++done % 2000 === 0) {
        console.log(`  ${done}/${ids.length} (${withPrice} priced)`);
      }
    }
  }
  await Promise.all(Array.from({length: CONCURRENCY}, worker));

  await writeFile(
    OUT,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      count: withPrice,
      values,
    }),
  );
  console.log(`Done. ${withPrice}/${ids.length} priced → cardValues.json`);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
