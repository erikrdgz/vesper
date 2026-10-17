/**
 * Chart data, with the same fallback discipline as the quotes.
 *
 * Two things here exist purely because CoinGecko's free tier rate-limits
 * by IP, and that limit is shared by everyone behind the same address:
 *
 * 1. History is cached to disk for an hour, so a reload costs nothing. It
 *    used to be memory-only, which meant every refresh paid full price and
 *    walked straight into a 429.
 * 2. The portfolio's requests are issued one at a time with a gap, rather
 *    than as a `Promise.all` burst. Four simultaneous requests is exactly
 *    the shape that trips the limiter.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { PriceError, fetchMarketChart } from "../data/prices";
import { loadChartCache, saveChartCache } from "../data/storage";
import { combineSeries, syntheticSeries, timeGrid, type Holding } from "../lib/series";
import { isDeFi, type ChartRange, type PriceSource, type SeriesPoint } from "../types";
import { useNetWorth } from "./useNetWorth";
import { useVesper } from "./useVesper";

const CACHE_TTL_MS = 60 * 60 * 1000;

/** Gap between sequential history requests. */
const REQUEST_GAP_MS = 350;

const cache = new Map<string, { points: SeriesPoint[]; at: number }>();

/**
 * Pull the persisted cache in once, at module load.
 *
 * Fire-and-forget: anything that renders before this resolves simply
 * misses the cache and fetches, which is the old behaviour rather than a
 * failure.
 */
let hydration: Promise<void> | null = null;
function hydrateCache(): Promise<void> {
  if (!hydration) {
    hydration = loadChartCache().then((stored) => {
      for (const [key, entry] of Object.entries(stored)) {
        if (!cache.has(key)) cache.set(key, entry);
      }
    });
  }
  return hydration;
}

function cached(key: string): SeriesPoint[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.points;
}

function remember(key: string, points: SeriesPoint[]): void {
  cache.set(key, { points, at: Date.now() });
  saveChartCache(Object.fromEntries(cache));
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface SeriesState {
  points: SeriesPoint[];
  /** "live" from CoinGecko, "fallback" for the deterministic stand-in. */
  source: Exclude<PriceSource, "cached">;
  loading: boolean;
}

/**
 * History for one coin.
 *
 * `anchorPrice` is the price currently on screen. The synthetic fallback
 * ends exactly there, so a chart never disagrees with the number above it.
 */
export function useAssetSeries(
  coingeckoId: string,
  range: ChartRange,
  anchorPrice: number,
): SeriesState {
  const [state, setState] = useState<SeriesState>(() => ({
    points: cached(`${coingeckoId}:${range}`) ?? [],
    source: "live",
    loading: true,
  }));

  // Keep the anchor out of the effect's deps: it ticks every two minutes
  // with the price refresh, and refetching a year of history for that
  // would be absurd.
  const anchorRef = useRef(anchorPrice);
  anchorRef.current = anchorPrice;

  useEffect(() => {
    const key = `${coingeckoId}:${range}`;
    const controller = new AbortController();

    void (async () => {
      await hydrateCache();
      if (controller.signal.aborted) return;

      const hit = cached(key);
      if (hit) {
        setState({ points: hit, source: "live", loading: false });
        return;
      }

      setState((previous) => ({ ...previous, loading: true }));

      try {
        const points = await fetchMarketChart(coingeckoId, range, controller.signal);
        if (controller.signal.aborted) return;
        remember(key, points);
        setState({ points, source: "live", loading: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!(error instanceof PriceError)) return;
        setState({
          points: syntheticSeries(coingeckoId + range, range, anchorRef.current),
          source: "fallback",
          loading: false,
        });
      }
    })();

    return () => controller.abort();
  }, [coingeckoId, range]);

  return state;
}

/**
 * The whole book on one line: every holding's history summed, plus the
 * stated balances held flat.
 */
export function usePortfolioSeries(range: ChartRange): SeriesState {
  const { assets, prices } = useVesper();
  const netWorth = useNetWorth();

  const holdings = useMemo(() => assets.filter(isDeFi), [assets]);
  const flatUsd = netWorth.tradFiUsd - netWorth.liabilitiesUsd;

  const [histories, setHistories] = useState<Record<string, SeriesPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [fellBack, setFellBack] = useState(false);

  const ids = useMemo(() => holdings.map((h) => h.coingeckoId).join(","), [holdings]);
  const quotesRef = useRef(prices.quotes);
  quotesRef.current = prices.quotes;

  useEffect(() => {
    if (holdings.length === 0) {
      setHistories({});
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    void (async () => {
      await hydrateCache();
      if (controller.signal.aborted) return;

      const collected: Record<string, SeriesPoint[]> = {};
      let anyFallback = false;
      let issued = 0;

      for (const holding of holdings) {
        if (controller.signal.aborted) return;

        const key = `${holding.coingeckoId}:${range}`;
        const hit = cached(key);
        if (hit) {
          collected[holding.coingeckoId] = hit;
          continue;
        }

        // Space out only the requests we actually send; cache hits should
        // not be made to wait for a limiter they never touch.
        if (issued > 0) await wait(REQUEST_GAP_MS);
        issued += 1;

        try {
          const points = await fetchMarketChart(holding.coingeckoId, range, controller.signal);
          remember(key, points);
          collected[holding.coingeckoId] = points;
        } catch {
          anyFallback = true;
          const anchor = quotesRef.current[holding.coingeckoId]?.usd ?? 0;
          collected[holding.coingeckoId] = syntheticSeries(
            holding.coingeckoId + range,
            range,
            anchor,
          );
        }

        // Show the line filling in rather than waiting for the last coin.
        if (!controller.signal.aborted) setHistories({ ...collected });
      }

      if (controller.signal.aborted) return;
      setHistories(collected);
      setFellBack(anyFallback);
      setLoading(false);
    })();

    return () => controller.abort();
    // `ids` stands in for `holdings`, which is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, range]);

  const points = useMemo(() => {
    const entries: Holding[] = holdings.map((holding) => ({
      amount: holding.amount,
      points: histories[holding.coingeckoId] ?? [],
    }));
    return combineSeries(entries, flatUsd, timeGrid(range));
  }, [holdings, histories, flatUsd, range]);

  return { points, source: fellBack ? "fallback" : "live", loading };
}
