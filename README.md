# Vesper

A wealth dashboard that holds bank balances and crypto holdings in one
place, and is honest about the difference between them.

A checking account is worth what the bank says it is worth. Half a Bitcoin
is worth whatever the last trade says, and that number is stale by the time
it finishes rendering. Most dashboards flatten those into one list of rows,
and then one failed price fetch tells you your net worth is zero. Vesper
keeps them as separate types all the way down, and prints where every number
came from.

Live at **https://erikrdgz.github.io/vesper/**

## Built with

React Native primitives throughout — `View`, `Text`, `Pressable`,
`ScrollView` — compiled to the web by Expo and exported as a static site. No
web-only UI library, no separate web codebase. The same components would run
on a phone.

- **Expo SDK 58** with Metro as the web bundler
- **TypeScript**, strict, with `noUncheckedIndexedAccess`
- **react-native-svg** for every chart; no charting library
- **expo-linear-gradient** for the hero and chart fills
- **AsyncStorage** for local persistence
- **CoinGecko** `/simple/price` for live BTC, ETH, SOL and LINK valuations

## Running it

```bash
npm install
npm run web
```

| Script | What it does |
| --- | --- |
| `npm run web` | Dev server on the web target |
| `npm run ios` / `npm run android` | The same app on a device or simulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Node's test runner over the pure aggregation layer |
| `npm run build:web` | Static export to `dist/` |

## How the data works

Three layers, each of which can fail without taking the screen down.

1. **`src/data/prices.ts`** fetches live quotes. CoinGecko's free tier is
   rate limited per IP and shared with everyone else behind it, so the
   client sends one request per refresh, floors the refresh interval at a
   minute, and surrenders quietly on a 429.
2. **`src/data/storage.ts`** keeps the last good quote set, the book of
   accounts and the motion preference under one versioned key. Reads are
   defensive — a blob from an older build is treated as absent rather than
   repaired.
3. **`src/lib/netWorth.ts`** does the arithmetic, with no React in it, so
   the numbers every screen depends on can be tested in a plain node
   process.

Prices fall back live → cached → seeded, and `prices.source` travels with
the numbers so the UI can say which one you are looking at rather than
letting a stale figure pass as a live one.

## Deployment

`npm run build:web` produces a static `dist/`, which GitHub Actions
publishes to Pages on every push to `main`. Nothing touches Expo's hosting.
The subpath is handled by `experiments.baseUrl` in `app.json`.

## What it is not

Vesper connects to no bank and holds no keys. The accounts are seeded mock
data you can edit, stored in your own browser and sent nowhere. The only
network call it makes is to CoinGecko for public prices.
