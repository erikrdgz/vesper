/**
 * CoinGecko's public `/simple/price` endpoint.
 *
 * No key, no proxy, no server. The page is static on GitHub Pages, so this
 * runs in the visitor's browser against CoinGecko's CORS-enabled public
 * tier. That tier is rate limited somewhere around 5–15 calls a minute per
 * IP, shared with everyone else on that IP, so the client is built to be
 * rude to itself: one request per refresh, a floor on how often a refresh
 * can happen, and a quiet surrender to the cache on 429.
 *
 * The contract with the UI is that this never throws and never returns a
 * partial truth. Either you get a complete quote map, or you get an error
 * and the caller falls back to cache and then to seed.
 */

import type { ChartRange, QuoteMap, SeriesPoint } from "../types";

const ENDPOINT = "https://api.coingecko.com/api/v3/simple/price";
const CHART_ENDPOINT = "https://api.coingecko.com/api/v3/coins";

/** Give up on a request after this long. */
const TIMEOUT_MS = 8000;

/** The soonest a refresh may follow the previous one. */
export const MIN_REFRESH_MS = 60_000;

/** How often the app refreshes on its own while open. */
export const AUTO_REFRESH_MS = 120_000;

/** Raw shape CoinGecko returns for `include_24hr_change=true`. */
type CoinGeckoResponse = Record<string, { usd?: number; usd_24h_change?: number }>;

export class PriceError extends Error {
  readonly rateLimited: boolean;
  constructor(message: string, rateLimited = false) {
    super(message);
    this.name = "PriceError";
    this.rateLimited = rateLimited;
  }
}

/**
 * Fetch quotes for the given CoinGecko ids.
 *
 * Ids are de-duplicated and sorted so that the same holdings always produce
 * the same URL, which lets the browser's own HTTP cache absorb a repeat.
 */
export async function fetchQuotes(ids: string[], signal?: AbortSignal): Promise<QuoteMap> {
  const unique = Array.from(new Set(ids.filter(Boolean))).sort();
  if (unique.length === 0) return {};

  const url =
    `${ENDPOINT}?ids=${encodeURIComponent(unique.join(","))}` +
    `&vs_currencies=usd&include_24hr_change=true`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Fold an outer abort (component unmount) into our own controller.
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener("abort", onOuterAbort);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (response.status === 429) {
      throw new PriceError("CoinGecko rate limit reached", true);
    }
    if (!response.ok) {
      throw new PriceError(`CoinGecko responded ${response.status}`);
    }

    const payload = (await response.json()) as CoinGeckoResponse;
    const quotes: QuoteMap = {};

    for (const id of unique) {
      const entry = payload[id];
      // A missing or non-numeric price is dropped rather than coerced to 0,
      // so a bad id cannot silently wipe value off the net-worth total.
      if (!entry || typeof entry.usd !== "number" || !Number.isFinite(entry.usd)) continue;
      quotes[id] = {
        usd: entry.usd,
        change24h:
          typeof entry.usd_24h_change === "number" && Number.isFinite(entry.usd_24h_change)
            ? entry.usd_24h_change
            : 0,
      };
    }

    if (Object.keys(quotes).length === 0) {
      throw new PriceError("CoinGecko returned no usable prices");
    }

    return quotes;
  } catch (error) {
    if (error instanceof PriceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new PriceError("Price request timed out");
    }
    throw new PriceError("Could not reach CoinGecko");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }
}

/* ------------------------------------------------------------------ */
/* Market history                                                      */
/* ------------------------------------------------------------------ */

/** How many days of history each range asks CoinGecko for. */
const RANGE_DAYS: Record<ChartRange, number> = {
  "1H": 1,
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "1Y": 365,
};

/**
 * How much of the returned series each range keeps.
 *
 * CoinGecko's granularity is fixed by `days`: under 1 day it returns
 * roughly five-minute points, 1–90 days hourly, beyond that daily. There is
 * no way to ask for "the last hour" directly, so 1H and 1D both fetch a day
 * and 1H trims the tail.
 */
const RANGE_WINDOW_MS: Record<ChartRange, number> = {
  "1H": 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};

/**
 * Daily price history for one coin.
 *
 * Separate from `fetchQuotes` because it is far more expensive and far less
 * urgent: a balance has to be right now, a chart can be an hour old. The
 * caller caches on that basis.
 */
export async function fetchMarketChart(
  coingeckoId: string,
  range: ChartRange,
  signal?: AbortSignal,
): Promise<SeriesPoint[]> {
  const days = RANGE_DAYS[range];
  const url =
    `${CHART_ENDPOINT}/${encodeURIComponent(coingeckoId)}/market_chart` +
    `?vs_currency=usd&days=${days}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener("abort", onOuterAbort);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (response.status === 429) throw new PriceError("CoinGecko rate limit reached", true);
    if (!response.ok) throw new PriceError(`CoinGecko responded ${response.status}`);

    const payload = (await response.json()) as { prices?: [number, number][] };
    if (!Array.isArray(payload.prices) || payload.prices.length === 0) {
      throw new PriceError("CoinGecko returned no history");
    }

    const cutoff = Date.now() - RANGE_WINDOW_MS[range];
    const points = payload.prices
      .filter(
        (pair): pair is [number, number] =>
          Array.isArray(pair) &&
          typeof pair[0] === "number" &&
          typeof pair[1] === "number" &&
          Number.isFinite(pair[1]),
      )
      .map(([t, v]) => ({ t, v }))
      .filter((point) => point.t >= cutoff);

    // A trim that leaves too little to draw is worse than a slightly wider
    // window, so fall back to the untrimmed series.
    if (points.length < 2) {
      return payload.prices
        .filter((pair) => Array.isArray(pair) && Number.isFinite(pair[1]))
        .map(([t, v]) => ({ t, v }));
    }

    return points;
  } catch (error) {
    if (error instanceof PriceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new PriceError("History request timed out");
    }
    throw new PriceError("Could not reach CoinGecko");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }
}
