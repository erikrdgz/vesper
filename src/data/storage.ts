/**
 * Local persistence.
 *
 * AsyncStorage on native, localStorage underneath on web. One key, one
 * versioned blob, written on a trailing debounce so that dragging a slider
 * does not produce two hundred writes.
 *
 * Every read is defensive. Storage can be unavailable (Safari private mode
 * throws on access rather than returning null), the blob can be from an
 * older build, or it can be something else entirely if a key collides. A
 * bad read returns `null` and the app falls back to the seed, which is
 * always a working dashboard.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Asset, PersistedState, QuoteMap, Transaction } from "../types";

const KEY = "vesper.state.v1";
const CHART_KEY = "vesper.charts.v1";
const WRITE_DEBOUNCE_MS = 400;

/** How old a cached quote set can be before we stop trusting it at all. */
export const QUOTE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 12;

function isTransactionArray(value: unknown): value is Transaction[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Transaction).id === "string" &&
        typeof (item as Transaction).amountUsd === "number",
    )
  );
}

function isAssetArray(value: unknown): value is Asset[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Asset).id === "string" &&
        ((item as Asset).class === "tradfi" || (item as Asset).class === "defi"),
    )
  );
}

/**
 * Read persisted state, or `null` if there is nothing usable.
 *
 * Anything that fails validation is treated as absent rather than repaired.
 * A half-migrated book of accounts is worse than a fresh one.
 */
export async function loadState(): Promise<PersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const candidate = parsed as Partial<PersistedState>;
    if (candidate.version !== 1) return null;
    if (!isAssetArray(candidate.assets)) return null;

    const fetchedAt =
      typeof candidate.quotesFetchedAt === "number" ? candidate.quotesFetchedAt : null;

    // A quote set older than the cache window is dropped, not shown stale.
    const fresh = fetchedAt !== null && Date.now() - fetchedAt < QUOTE_CACHE_MAX_AGE_MS;

    return {
      version: 1,
      assets: candidate.assets,
      // Transactions are cosmetic, so a bad list degrades to empty rather
      // than throwing the whole save away with the balances in it.
      transactions: isTransactionArray(candidate.transactions) ? candidate.transactions : [],
      quotes: fresh ? ((candidate.quotes as QuoteMap | null) ?? null) : null,
      quotesFetchedAt: fresh ? fetchedAt : null,
      reduceMotion: typeof candidate.reduceMotion === "boolean" ? candidate.reduceMotion : null,
    };
  } catch {
    return null;
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pending: PersistedState | null = null;

/**
 * Queue a write. Repeated calls inside the debounce window collapse into one.
 *
 * Failures are swallowed: being unable to persist is not a reason to
 * interrupt someone reading their balances.
 */
export function saveState(state: PersistedState): void {
  pending = state;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const snapshot = pending;
    writeTimer = null;
    pending = null;
    if (!snapshot) return;
    AsyncStorage.setItem(KEY, JSON.stringify(snapshot)).catch(() => {});
  }, WRITE_DEBOUNCE_MS);
}

/** Drop everything and return to the seed. Used by Settings. */
export async function clearState(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    pending = null;
  }
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do; the caller resets in-memory state regardless.
  }
}

/* ------------------------------------------------------------------ */
/* Chart history cache                                                 */
/* ------------------------------------------------------------------ */

/**
 * Price history, cached across reloads.
 *
 * Kept under its own key and read separately from the book of accounts,
 * because it is large, disposable, and must never be able to corrupt the
 * balances by sharing a parse with them.
 *
 * This exists because CoinGecko's free tier rate-limits by IP, a cold load
 * costs one request per holding, and without this every refresh paid that
 * cost again until the limit cut in.
 */
export const CHART_CACHE_TTL_MS = 1000 * 60 * 60;

type ChartCache = Record<string, { points: { t: number; v: number }[]; at: number }>;

export async function loadChartCache(): Promise<ChartCache> {
  try {
    const raw = await AsyncStorage.getItem(CHART_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const out: ChartCache = {};
    for (const [key, entry] of Object.entries(parsed as ChartCache)) {
      if (!entry || typeof entry.at !== "number" || !Array.isArray(entry.points)) continue;
      if (Date.now() - entry.at > CHART_CACHE_TTL_MS) continue;
      out[key] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

let chartTimer: ReturnType<typeof setTimeout> | null = null;

export function saveChartCache(cache: ChartCache): void {
  if (chartTimer) clearTimeout(chartTimer);
  chartTimer = setTimeout(() => {
    chartTimer = null;
    AsyncStorage.setItem(CHART_KEY, JSON.stringify(cache)).catch(() => {});
  }, 1000);
}
