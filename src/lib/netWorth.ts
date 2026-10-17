/**
 * The aggregation layer: the one place TradFi and DeFi are allowed to meet.
 *
 * Deliberately free of React and of react-native, so the arithmetic that
 * every balance on screen depends on can be tested in a plain node process
 * in milliseconds. `src/hooks/useNetWorth.ts` is the thin memoised wrapper.
 */

import { isDeFi, type Asset, type NetWorth, type QuoteMap, type ValuedAsset } from "../types";

/**
 * Value every asset, then total the book.
 *
 * Two rules do most of the work here:
 *
 * 1. A credit balance is stored positive and valued negative. It subtracts
 *    from net worth but never from the denominator of an allocation
 *    percentage, because "this card is 4% of my portfolio" is nonsense.
 *
 * 2. Only DeFi can move the 24h figure. Marking a checking account to
 *    market every time Bitcoin twitches would make the daily change
 *    meaningless, so stated balances contribute zero movement by design.
 */
export function computeNetWorth(assets: Asset[], quotes: QuoteMap): NetWorth {
  const valued: ValuedAsset[] = assets.map((asset) => {
    if (isDeFi(asset)) {
      const quote = quotes[asset.coingeckoId];
      if (!quote) {
        return {
          asset,
          valueUsd: 0,
          weight: 0,
          change24hUsd: 0,
          change24hPct: 0,
          priced: false,
          costUsd: asset.costBasisUsd ?? null,
          gainUsd: null,
          gainPct: null,
        };
      }

      const valueUsd = asset.amount * quote.usd;

      // Back out yesterday's value from the percentage so the dollar figure
      // and the percentage can never disagree on screen.
      const previous = valueUsd / (1 + quote.change24h / 100);
      const change24hUsd = Number.isFinite(previous) ? valueUsd - previous : 0;

      return {
        asset,
        valueUsd,
        weight: 0, // filled in below, once the base is known
        change24hUsd,
        change24hPct: quote.change24h,
        priced: true,
        ...gainOn(valueUsd, asset.costBasisUsd),
      };
    }

    const owed = asset.kind === "credit";
    const valueUsd = owed ? -asset.balanceUsd : asset.balanceUsd;
    return {
      asset,
      valueUsd,
      weight: 0,
      change24hUsd: 0,
      change24hPct: 0,
      priced: true,
      // A liability has no cost basis, whatever is stored on it.
      ...(owed
        ? { costUsd: null, gainUsd: null, gainPct: null }
        : gainOn(valueUsd, asset.costBasisUsd)),
    };
  });

  let tradFiUsd = 0;
  let deFiUsd = 0;
  let liabilitiesUsd = 0;
  let change24hUsd = 0;
  let costUsd = 0;
  let trackedValueUsd = 0;

  for (const entry of valued) {
    // Only positions with a recorded basis count toward the return, so a
    // cash balance cannot dilute the number by contributing value at
    // zero cost.
    if (entry.costUsd !== null) {
      costUsd += entry.costUsd;
      trackedValueUsd += entry.valueUsd;
    }

    if (isDeFi(entry.asset)) {
      deFiUsd += entry.valueUsd;
      change24hUsd += entry.change24hUsd;
    } else if (entry.asset.kind === "credit") {
      liabilitiesUsd += -entry.valueUsd;
    } else {
      tradFiUsd += entry.valueUsd;
    }
  }

  // Allocation is a share of what you own, not of what you own net of debt.
  const grossAssets = tradFiUsd + deFiUsd;
  if (grossAssets > 0) {
    for (const entry of valued) {
      if (entry.valueUsd > 0) entry.weight = entry.valueUsd / grossAssets;
    }
  }

  const totalUsd = grossAssets - liabilitiesUsd;
  const previousTotal = totalUsd - change24hUsd;
  const change24hPct =
    previousTotal > 0 && Number.isFinite(previousTotal) ? (change24hUsd / previousTotal) * 100 : 0;

  valued.sort((a, b) => b.valueUsd - a.valueUsd);

  const gainUsd = trackedValueUsd - costUsd;
  const gainPct = costUsd > 0 ? (gainUsd / costUsd) * 100 : 0;

  return {
    totalUsd,
    tradFiUsd,
    deFiUsd,
    liabilitiesUsd,
    change24hUsd,
    change24hPct,
    costUsd,
    gainUsd,
    gainPct,
    trackedValueUsd,
    valued,
  };
}

/**
 * Gain against a basis, or nulls when there is no basis.
 *
 * A basis of zero is treated as untracked rather than as a free
 * position: dividing by it would report an infinite return, and the
 * honest reading of "0" in that field is "nobody filled this in".
 */
function gainOn(
  valueUsd: number,
  costBasisUsd: number | undefined,
): { costUsd: number | null; gainUsd: number | null; gainPct: number | null } {
  if (costBasisUsd === undefined || !Number.isFinite(costBasisUsd) || costBasisUsd <= 0) {
    return { costUsd: null, gainUsd: null, gainPct: null };
  }
  const gainUsd = valueUsd - costBasisUsd;
  return { costUsd: costBasisUsd, gainUsd, gainPct: (gainUsd / costBasisUsd) * 100 };
}
