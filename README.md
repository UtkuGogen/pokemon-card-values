# pokemon-card-values

Precomputed Pokémon card **value index** for the Scan Card Value app.

TCGdex serves pricing only per-card (in each card's detail response), with no
bulk "all prices" endpoint. This repo's `buildValueIndex.mjs` fetches every
card's price once and collapses it into a single small file, `cardValues.json`
(`{ id → representative USD value }`), that the app downloads and uses to
sort/show value across the whole catalog.

## Automatic monthly refresh

`.github/workflows/build-values.yml` regenerates `cardValues.json` on the 1st
of each month (and on manual **Run workflow**) and commits it. The app fetches
the raw file at runtime, so values update **without an app release**:

```
https://raw.githubusercontent.com/UtkuGogen/pokemon-card-values/main/cardValues.json
```

## Run locally

```
node buildValueIndex.mjs
```

Requires Node 18+ (uses global `fetch`).
