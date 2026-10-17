/**
 * The tokens Vesper knows by name.
 *
 * Shared by the add-asset sheet and the watchlist, so somebody can watch a
 * token they do not hold without typing a CoinGecko id. Deliberately short:
 * every entry here is one more id in the price request, and the free tier
 * counts requests, not ids, so the list is cheap but the UI is not helped
 * by two hundred rows.
 */

export interface CatalogEntry {
  symbol: string;
  label: string;
  coingeckoId: string;
}

export const TOKEN_CATALOG: readonly CatalogEntry[] = [
  { symbol: "BTC", label: "Bitcoin", coingeckoId: "bitcoin" },
  { symbol: "ETH", label: "Ethereum", coingeckoId: "ethereum" },
  { symbol: "SOL", label: "Solana", coingeckoId: "solana" },
  { symbol: "LINK", label: "Chainlink", coingeckoId: "chainlink" },
  { symbol: "ADA", label: "Cardano", coingeckoId: "cardano" },
  { symbol: "DOT", label: "Polkadot", coingeckoId: "polkadot" },
  { symbol: "AVAX", label: "Avalanche", coingeckoId: "avalanche-2" },
  { symbol: "MATIC", label: "Polygon", coingeckoId: "matic-network" },
];

export const catalogById = (id: string): CatalogEntry | undefined =>
  TOKEN_CATALOG.find((entry) => entry.coingeckoId === id);

/**
 * What the watchlist starts as.
 *
 * Two of these are not held, which is the point of a watchlist: a row you
 * are following rather than one you own.
 */
export const seedWatchlist: string[] = [
  "bitcoin",
  "ethereum",
  "solana",
  "chainlink",
  "cardano",
  "avalanche-2",
];
