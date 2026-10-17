/**
 * The arithmetic the whole dashboard rests on.
 *
 * These run in plain node with type stripping, no renderer and no jest, so
 * CI gets an answer in under a second. Everything asserted here is a rule
 * that would otherwise only be visible by reading four screens.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { computeNetWorth } from "../src/lib/netWorth";
import type { Asset, QuoteMap } from "../src/types";

const quotes: QuoteMap = {
  bitcoin: { usd: 100_000, change24h: 10 },
  ethereum: { usd: 4_000, change24h: -20 },
};

const checking: Asset = {
  id: "a",
  class: "tradfi",
  kind: "cash",
  institution: "Chase",
  label: "Chase Checking",
  balanceUsd: 4_500,
};

const card: Asset = {
  id: "b",
  class: "tradfi",
  kind: "credit",
  institution: "Chase",
  label: "Sapphire",
  balanceUsd: 2_000,
};

const btc: Asset = {
  id: "c",
  class: "defi",
  symbol: "BTC",
  label: "Bitcoin",
  amount: 0.5,
  coingeckoId: "bitcoin",
};

test("stated balances and marked-to-market holdings total together", () => {
  const result = computeNetWorth([checking, btc], quotes);
  assert.equal(result.tradFiUsd, 4_500);
  assert.equal(result.deFiUsd, 50_000);
  assert.equal(result.totalUsd, 54_500);
});

test("a credit balance subtracts from net worth", () => {
  const result = computeNetWorth([checking, card], quotes);
  assert.equal(result.liabilitiesUsd, 2_000);
  assert.equal(result.totalUsd, 2_500);
  // And it is not folded into the TradFi subtotal.
  assert.equal(result.tradFiUsd, 4_500);
});

test("a credit balance is excluded from the allocation base", () => {
  const result = computeNetWorth([checking, card], quotes);
  const checkingRow = result.valued.find((entry) => entry.asset.id === "a");
  // 4,500 of 4,500 gross assets. The card does not dilute it to 69%.
  assert.equal(checkingRow?.weight, 1);
  const cardRow = result.valued.find((entry) => entry.asset.id === "b");
  assert.equal(cardRow?.weight, 0);
});

test("stated balances contribute no 24h movement", () => {
  const result = computeNetWorth([checking], quotes);
  assert.equal(result.change24hUsd, 0);
  assert.equal(result.change24hPct, 0);
});

test("the 24h dollar figure is derived from the percentage, not assumed", () => {
  // 0.5 BTC at 100k is 50,000 today after a +10% day, so yesterday it was
  // 50,000 / 1.1 = 45,454.55 and the move is 4,545.45 — not 5,000.
  const result = computeNetWorth([btc], quotes);
  assert.ok(Math.abs(result.change24hUsd - 4_545.4545) < 0.01);
});

test("a negative day is handled with the same formula", () => {
  const eth: Asset = {
    id: "d",
    class: "defi",
    symbol: "ETH",
    label: "Ethereum",
    amount: 2,
    coingeckoId: "ethereum",
  };
  // 8,000 today after a -20% day means 10,000 yesterday, a 2,000 fall.
  const result = computeNetWorth([eth], quotes);
  assert.ok(Math.abs(result.change24hUsd + 2_000) < 0.01);
});

test("an unpriced token is flagged rather than valued at zero silently", () => {
  const unknown: Asset = {
    id: "e",
    class: "defi",
    symbol: "XYZ",
    label: "Unknown",
    amount: 100,
    coingeckoId: "not-a-real-coin",
  };
  const result = computeNetWorth([checking, unknown], quotes);
  const row = result.valued.find((entry) => entry.asset.id === "e");
  assert.equal(row?.priced, false);
  assert.equal(row?.valueUsd, 0);
  // The rest of the book is unaffected.
  assert.equal(result.totalUsd, 4_500);
});

test("an empty book does not produce NaN", () => {
  const result = computeNetWorth([], {});
  assert.equal(result.totalUsd, 0);
  assert.equal(result.change24hPct, 0);
  assert.deepEqual(result.valued, []);
});

test("rows come back sorted by value, largest first", () => {
  const result = computeNetWorth([checking, btc, card], quotes);
  assert.deepEqual(
    result.valued.map((entry) => entry.asset.id),
    ["c", "a", "b"],
  );
});

test("weights across positive holdings sum to one", () => {
  const result = computeNetWorth([checking, btc, card], quotes);
  const total = result.valued.reduce((sum, entry) => sum + entry.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("a position with a basis reports gain in dollars and percent", () => {
  const held: Asset = {
    id: "g",
    class: "defi",
    symbol: "BTC",
    label: "Bitcoin",
    amount: 1,
    coingeckoId: "bitcoin",
    costBasisUsd: 80_000,
  };
  const result = computeNetWorth([held], quotes);
  const row = result.valued[0]!;
  assert.equal(row.costUsd, 80_000);
  assert.equal(row.gainUsd, 20_000);
  assert.equal(row.gainPct, 25);
});

test("cash without a basis is left out of the return, not counted at zero cost", () => {
  const held: Asset = {
    id: "h",
    class: "defi",
    symbol: "BTC",
    label: "Bitcoin",
    amount: 1,
    coingeckoId: "bitcoin",
    costBasisUsd: 80_000,
  };
  // 4,500 of cash alongside a 100k position up 20k. Folding the cash in
  // at zero cost would report 24.2% instead of the true 25%.
  const result = computeNetWorth([held, checking], quotes);
  assert.equal(result.costUsd, 80_000);
  assert.equal(result.trackedValueUsd, 100_000);
  assert.equal(result.gainPct, 25);
});

test("a zero basis is read as untracked rather than an infinite return", () => {
  const free: Asset = {
    id: "i",
    class: "defi",
    symbol: "BTC",
    label: "Bitcoin",
    amount: 1,
    coingeckoId: "bitcoin",
    costBasisUsd: 0,
  };
  const row = computeNetWorth([free], quotes).valued[0]!;
  assert.equal(row.costUsd, null);
  assert.equal(row.gainPct, null);
});

test("a liability never reports a gain", () => {
  const row = computeNetWorth([card], quotes).valued.find((e) => e.asset.id === "b");
  assert.equal(row?.costUsd, null);
  assert.equal(row?.gainUsd, null);
});

test("a book with no bases at all reports zero return rather than NaN", () => {
  const result = computeNetWorth([checking], quotes);
  assert.equal(result.costUsd, 0);
  assert.equal(result.gainPct, 0);
  assert.ok(Number.isFinite(result.gainUsd));
});
