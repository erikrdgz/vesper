/**
 * Swapping one holding for another.
 *
 * Pure, so the arithmetic that moves someone's position between two
 * assets can be asserted without a renderer. Vesper settles nothing — the
 * swap rewrites local state and nothing else — but the accounting still
 * has to be right, because a wrong cost basis quietly poisons every
 * return figure on every screen from then on.
 *
 * The rule, which is the same one a tax authority would use: a swap is a
 * disposal and an acquisition. You dispose of part of the source position
 * at today's price, which removes that fraction of its cost, and you
 * acquire the destination at today's price, which adds what you paid for
 * it to that position's cost.
 */

import { isDeFi, type Asset, type DeFiAsset, type QuoteMap } from "../types";

/** Taken off the receiving side, as a real exchange would. 30bps. */
export const SWAP_FEE_BPS = 30;

export interface SwapQuote {
  /** USD value of what is being given up. */
  fromUsd: number;
  /** Fee in USD, taken from the proceeds. */
  feeUsd: number;
  /** USD value actually converted, after the fee. */
  netUsd: number;
  /** Units of the destination token received. */
  toAmount: number;
  /** How many destination units one source unit buys, before the fee. */
  rate: number;
}

export type SwapError =
  | "same-asset"
  | "no-price"
  | "bad-amount"
  | "insufficient"
  | "not-found";

/**
 * Price a swap without applying it.
 *
 * Returns a discriminated result rather than throwing, because every one
 * of these cases is something the form has to render next to a field
 * rather than something that should unwind a render.
 */
export function quoteSwap(
  assets: Asset[],
  fromId: string,
  toId: string,
  amount: number,
  quotes: QuoteMap,
): { ok: true; quote: SwapQuote } | { ok: false; error: SwapError } {
  if (fromId === toId) return { ok: false, error: "same-asset" };

  const from = assets.find((asset) => asset.id === fromId);
  const to = assets.find((asset) => asset.id === toId);
  if (!from || !to || !isDeFi(from) || !isDeFi(to)) return { ok: false, error: "not-found" };

  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "bad-amount" };
  if (amount > from.amount) return { ok: false, error: "insufficient" };

  const fromPrice = quotes[from.coingeckoId]?.usd;
  const toPrice = quotes[to.coingeckoId]?.usd;
  if (!fromPrice || !toPrice) return { ok: false, error: "no-price" };

  const fromUsd = amount * fromPrice;
  const feeUsd = fromUsd * (SWAP_FEE_BPS / 10_000);
  const netUsd = fromUsd - feeUsd;

  return {
    ok: true,
    quote: {
      fromUsd,
      feeUsd,
      netUsd,
      toAmount: netUsd / toPrice,
      rate: fromPrice / toPrice,
    },
  };
}

/**
 * Apply a priced swap to the book.
 *
 * Returns a new array; the caller replaces state with it. A source
 * position taken to zero is kept rather than removed, so its cost basis
 * does not vanish from the record along with it — an emptied position
 * that still shows what it cost is the difference between a portfolio
 * and a balance sheet.
 */
export function applySwap(
  assets: Asset[],
  fromId: string,
  toId: string,
  amount: number,
  quote: SwapQuote,
): Asset[] {
  return assets.map((asset) => {
    if (!isDeFi(asset)) return asset;

    if (asset.id === fromId) {
      const remaining = Math.max(0, asset.amount - amount);
      // The disposed fraction takes its share of the cost with it, which
      // leaves the average cost per remaining unit unchanged.
      const keptFraction = asset.amount > 0 ? remaining / asset.amount : 0;
      const costBasisUsd =
        asset.costBasisUsd === undefined
          ? undefined
          : round(asset.costBasisUsd * keptFraction);

      return { ...asset, amount: round(remaining, 8), costBasisUsd } satisfies DeFiAsset;
    }

    if (asset.id === toId) {
      // Acquired at today's price, so what it cost is what was converted.
      const costBasisUsd = round((asset.costBasisUsd ?? 0) + quote.netUsd);
      return {
        ...asset,
        amount: round(asset.amount + quote.toAmount, 8),
        costBasisUsd,
      } satisfies DeFiAsset;
    }

    return asset;
  });
}

/** Keep stored numbers from accumulating float dust across many swaps. */
function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** What went wrong, in words a form can show. */
export const SWAP_MESSAGE: Record<SwapError, string> = {
  "same-asset": "Pick two different tokens.",
  "no-price": "No live price for one of these, so the rate would be a guess.",
  "bad-amount": "Enter an amount above zero.",
  insufficient: "That is more than you hold.",
  "not-found": "That token is no longer in your book.",
};

/**
 * Gain taken out of the position by a swap.
 *
 * The disposed slice carried a share of the cost; the proceeds are what
 * actually came back after the fee. The difference is realised — it has
 * stopped being a number that moves with the market and become a number
 * that happened.
 *
 * Returns null when the source has no basis, because a gain measured
 * against an unknown cost is not a gain, it is a guess.
 */
export function realisedOn(
  source: DeFiAsset,
  amount: number,
  quote: SwapQuote,
): number | null {
  if (source.costBasisUsd === undefined || source.costBasisUsd <= 0) return null;
  if (source.amount <= 0) return null;

  const disposedFraction = Math.min(1, amount / source.amount);
  const disposedCost = source.costBasisUsd * disposedFraction;
  return quote.netUsd - disposedCost;
}
