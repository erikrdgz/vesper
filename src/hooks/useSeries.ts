/**
 * Chart data, with the same fallback discipline as the quotes.
 *
 * History is cached for an hour in memory. It is not persisted: a year of
 * hourly points for four coins is a lot of bytes to carry in local storage
 * for a line that is decorative the moment you stop looking at it, and a
 * refetch on reload costs one request.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { PriceError, fetchMarketChart } from "../data/prices";
import { combineSeries, syntheticSeries, timeGrid, type Holding } from "../lib/series";
import { isDeFi, type ChartRange, type PriceSource, type SeriesPoint } from "../types";
import { useNetWorth } from "./useNetWorth";
import { useVesper } from "./useVesper";

const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map<string, { points: SeriesPoint[]; at: number }>();

function cached(key: string): SeriesPoint[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.points;
}

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
  // with the price refresh, and refetching a year of history for that would
  // be absurd.
  const anchorRef = useRef(anchorPrice);
  anchorRef.current = anchorPrice;

  useEffect(() => {
    const key = `${coingeckoId}:${range}`;
    const hit = cached(key);
    if (hit) {
      setState({ points: hit, source: "live", loading: false });
      return;
    }

    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));

    fetchMarketChart(coingeckoId, range, controller.signal)
      .then((points) => {
        if (controller.signal.aborted) return;
        cache.set(key, { points, at: Date.now() });
        setState({ points, source: "live", loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (!(error instanceof PriceError)) return;
        setState({
          points: syntheticSeries(coingeckoId + range, range, anchorRef.current),
          source: "fallback",
          loading: false,
        });
      });

    return () => controller.abort();
  }, [coingeckoId, range]);

  return state;
}

/**
 * The whole book on one line: every holding's history summed, plus the
 * stated balances held flat.
 *
 * One request per coin, cached for an hour, which keeps a cold load at five
 * calls including the quote fetch — comfortably inside CoinGecko's free
 * tier even when several people share an IP.
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
    let anyFallback = false;

    Promise.all(
      holdings.map(async (holding) => {
        const key = `${holding.coingeckoId}:${range}`;
        const hit = cached(key);
        if (hit) return [holding.coingeckoId, hit] as const;

        try {
          const points = await fetchMarketChart(holding.coingeckoId, range, controller.signal);
          cache.set(key, { points, at: Date.now() });
          return [holding.coingeckoId, points] as const;
        } catch {
          anyFallback = true;
          const anchor = quotesRef.current[holding.coingeckoId]?.usd ?? 0;
          return [
            holding.coingeckoId,
            syntheticSeries(holding.coingeckoId + range, range, anchor),
          ] as const;
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setHistories(Object.fromEntries(entries));
      setFellBack(anyFallback);
      setLoading(false);
    });

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
