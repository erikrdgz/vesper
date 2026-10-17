/**
 * Swap accounting.
 *
 * These matter more than they look. A swap that gets the cost basis
 * wrong does not show an error — it shows a plausible return figure that
 * is quietly incorrect on every screen, forever, and nobody notices.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { SWAP_FEE_BPS, applySwap, quoteSwap } from "../src/lib/exchange";
import { isDeFi, type Asset, type QuoteMap } from "../src/types";

const quotes: QuoteMap = {
  bitcoin: { usd: 100_000, change24h: 0 },
  ethereum: { usd: 4_000, change24h: 0 },
};

const btc: Asset = {
  id: "btc",
  class: "defi",
  symbol: "BTC",
  label: "Bitcoin",
  amount: 1,
  coingeckoId: "bitcoin",
  costBasisUsd: 60_000,
};

const eth: Asset = {
  id: "eth",
  class: "defi",
  symbol: "ETH",
  label: "Ethereum",
  amount: 2,
  coingeckoId: "ethereum",
  costBasisUsd: 6_000,
};

const book = [btc, eth];
const amountOf = (assets: Asset[], id: string) => {
  const found = assets.find((a) => a.id === id);
  return found && isDeFi(found) ? found.amount : null;
};
const basisOf = (assets: Asset[], id: string) => {
  const found = assets.find((a) => a.id === id);
  return found && isDeFi(found) ? found.costBasisUsd : null;
};

test("a quote prices the swap and takes the fee off the proceeds", () => {
  const result = quoteSwap(book, "btc", "eth", 0.5, quotes);
  assert.ok(result.ok);

  const { quote } = result;
  assert.equal(quote.fromUsd, 50_000);
  assert.equal(quote.feeUsd, 50_000 * (SWAP_FEE_BPS / 10_000));
  assert.equal(quote.netUsd, 50_000 - quote.feeUsd);
  // Net, not gross: you receive what is left after the fee.
  assert.equal(quote.toAmount, quote.netUsd / 4_000);
  assert.equal(quote.rate, 25);
});

test("disposing half a position takes half its cost with it", () => {
  const result = quoteSwap(book, "btc", "eth", 0.5, quotes);
  assert.ok(result.ok);
  const after = applySwap(book, "btc", "eth", 0.5, result.quote);

  assert.equal(amountOf(after, "btc"), 0.5);
  // 60,000 basis on 1 BTC; half disposed leaves 30,000 on the half kept,
  // so the average cost per unit is unchanged at 60,000.
  assert.equal(basisOf(after, "btc"), 30_000);
});

test("the acquired side adds what was actually converted, not the gross", () => {
  const result = quoteSwap(book, "btc", "eth", 0.5, quotes);
  assert.ok(result.ok);
  const after = applySwap(book, "btc", "eth", 0.5, result.quote);

  // 6,000 already in, plus the net proceeds. The fee is not a cost of
  // the new position; it is money that left.
  assert.equal(basisOf(after, "eth"), 6_000 + result.quote.netUsd);
});

test("swapping everything empties the position but keeps the row", () => {
  const result = quoteSwap(book, "btc", "eth", 1, quotes);
  assert.ok(result.ok);
  const after = applySwap(book, "btc", "eth", 1, result.quote);

  assert.equal(amountOf(after, "btc"), 0);
  assert.equal(basisOf(after, "btc"), 0);
  assert.equal(after.length, 2, "the emptied position is kept, not dropped");
});

test("value is conserved across a swap, less the fee", () => {
  const result = quoteSwap(book, "btc", "eth", 0.5, quotes);
  assert.ok(result.ok);
  const after = applySwap(book, "btc", "eth", 0.5, result.quote);

  const valueOf = (assets: Asset[]) =>
    assets.reduce((sum, asset) => {
      if (!isDeFi(asset)) return sum;
      return sum + asset.amount * (quotes[asset.coingeckoId]?.usd ?? 0);
    }, 0);

  const before = valueOf(book);
  assert.ok(Math.abs(valueOf(after) - (before - result.quote.feeUsd)) < 0.01);
});

test("a swap larger than the holding is refused", () => {
  const result = quoteSwap(book, "btc", "eth", 2, quotes);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "insufficient");
});

test("a swap into the same asset is refused", () => {
  const result = quoteSwap(book, "btc", "btc", 0.1, quotes);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "same-asset");
});

test("a swap is refused when either side has no price", () => {
  const unpriced: Asset = {
    id: "xyz",
    class: "defi",
    symbol: "XYZ",
    label: "Unknown",
    amount: 5,
    coingeckoId: "nope",
    costBasisUsd: 100,
  };
  const result = quoteSwap([...book, unpriced], "btc", "xyz", 0.1, quotes);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "no-price");
});

test("zero and negative amounts are refused", () => {
  for (const amount of [0, -1, Number.NaN]) {
    const result = quoteSwap(book, "btc", "eth", amount, quotes);
    assert.equal(result.ok, false, `expected ${amount} to be refused`);
  }
});

test("an untracked source keeps its basis untracked after a swap", () => {
  const noBasis: Asset = { ...btc, costBasisUsd: undefined };
  const result = quoteSwap([noBasis, eth], "btc", "eth", 0.5, quotes);
  assert.ok(result.ok);
  const after = applySwap([noBasis, eth], "btc", "eth", 0.5, result.quote);
  assert.equal(basisOf(after, "btc"), undefined);
});
