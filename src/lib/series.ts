/**
 * Time-series maths for the charts.
 *
 * Pure, like `netWorth.ts`, and for the same reason: the portfolio chart is
 * the one place where several coins with different timestamps get added
 * together, and getting that wrong produces a line that looks plausible and
 * is wrong. Easier to assert than to eyeball.
 */

import type { ChartRange, SeriesPoint } from "../types";

/** Window length per range, used to build the common time grid. */
export const RANGE_MS: Record<ChartRange, number> = {
  "1H": 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};

/** How many points each range is drawn with. Enough to read, few enough to render. */
export const RANGE_RESOLUTION: Record<ChartRange, number> = {
  "1H": 60,
  "1D": 96,
  "1W": 84,
  "1M": 90,
  "1Y": 120,
};

/** Evenly spaced timestamps ending now. */
export function timeGrid(range: ChartRange, now = Date.now()): number[] {
  const count = RANGE_RESOLUTION[range];
  const span = RANGE_MS[range];
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(now - span + i * step));
}

/**
 * Sample a series onto a grid, carrying the last known value forward.
 *
 * Interpolating between points would draw a smoother line, but it would
 * also invent prices that never traded. Carrying forward is what actually
 * happened: the last print stood until the next one.
 */
export function resample(points: SeriesPoint[], grid: number[]): (number | null)[] {
  if (points.length === 0) return grid.map(() => null);

  const sorted = [...points].sort((a, b) => a.t - b.t);
  const out: (number | null)[] = [];
  let cursor = 0;
  let last: number | null = null;

  for (const t of grid) {
    while (cursor < sorted.length && sorted[cursor]!.t <= t) {
      last = sorted[cursor]!.v;
      cursor += 1;
    }
    // Before the first print there is genuinely no value; say so with null
    // rather than back-filling the earliest price across empty time.
    out.push(last);
  }

  return out;
}

export interface Holding {
  /** Token quantity held. */
  amount: number;
  /** That coin's price history. */
  points: SeriesPoint[];
}

/**
 * Sum several holdings onto one line, plus a flat stated balance.
 *
 * `flatUsd` is the TradFi half. It is genuinely flat: we hold no history of
 * bank balances, so the chart assumes they did not move. The UI says so
 * underneath rather than letting the line imply a record we do not have.
 *
 * A slot is only emitted once *every* holding has a price for it. Taking a
 * partial sum would draw a line that starts low and leaps when the last
 * coin's history begins — which looks like a crash that never happened,
 * and drags the y-scale so far that the real movement flattens out.
 */
export function combineSeries(
  holdings: Holding[],
  flatUsd: number,
  grid: number[],
): SeriesPoint[] {
  const priced = holdings.filter((holding) => holding.points.length > 0);
  if (priced.length === 0) {
    return grid.map((t) => ({ t, v: flatUsd }));
  }

  const columns = priced.map((holding) => resample(holding.points, grid));
  const out: SeriesPoint[] = [];

  for (let i = 0; i < grid.length; i += 1) {
    let total = 0;
    let complete = true;

    for (let c = 0; c < columns.length; c += 1) {
      const value = columns[c]![i];
      if (value == null) {
        complete = false;
        break;
      }
      total += value * priced[c]!.amount;
    }

    if (!complete) continue;
    out.push({ t: grid[i]!, v: total + flatUsd });
  }

  return out;
}

/**
 * A deterministic walk, used when CoinGecko is unreachable.
 *
 * Seeded from the coin id so the same asset always draws the same shape,
 * and anchored so the final point is the price we are actually showing —
 * a chart that ends somewhere other than the quoted price is worse than no
 * chart. Everything that renders this is labelled "indicative".
 */
export function syntheticSeries(
  seed: string,
  range: ChartRange,
  endValue: number,
  now = Date.now(),
): SeriesPoint[] {
  const grid = timeGrid(range, now);

  // xorshift32, seeded by a cheap string hash. Deterministic across reloads
  // and platforms, which `Math.random` is not.
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000;
  };

  // Longer ranges get a wider swing, which is what longer ranges look like.
  const volatility = range === "1H" ? 0.002 : range === "1D" ? 0.006 : range === "1W" ? 0.018 : 0.04;

  const walk: number[] = [];
  let value = 1;
  for (let i = 0; i < grid.length; i += 1) {
    value *= 1 + (next() - 0.5) * volatility * 2;
    walk.push(value);
  }

  // Rescale so the series ends exactly on the quoted price.
  const finalValue = walk[walk.length - 1]!;
  return grid.map((t, i) => ({ t, v: (walk[i]! / finalValue) * endValue }));
}

/** Min and max of a series, with a little headroom so the line never touches the edge. */
export function extent(points: SeriesPoint[]): { min: number; max: number } {
  if (points.length === 0) return { min: 0, max: 1 };

  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    if (point.v < min) min = point.v;
    if (point.v > max) max = point.v;
  }

  // A dead-flat series would otherwise divide by zero when scaled.
  if (min === max) return { min: min * 0.995, max: max * 1.005 || 1 };

  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}
