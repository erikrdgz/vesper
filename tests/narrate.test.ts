/**
 * What the app says about itself.
 *
 * Copy generated from data is the easiest place in an app to end up
 * lying: a rounding that turns a loss into "flat", a superlative that
 * fires on an empty list, a sentence about a mover when nothing moved.
 * These pin the rules that stop that.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { computeNetWorth } from "../src/lib/netWorth";
import { headline, observations, sinceLastVisit } from "../src/lib/narrate";
import type { Asset, PriceAlert, QuoteMap } from "../src/types";

const flatQuotes: QuoteMap = {
  bitcoin: { usd: 100_000, change24h: 0 },
  ethereum: { usd: 4_000, change24h: 0 },
};

const cash: Asset = {
  id: "cash",
  class: "tradfi",
  kind: "cash",
  institution: "Chase",
  label: "Chase Checking",
  balanceUsd: 5_000,
};

const btc = (costBasisUsd?: number): Asset => ({
  id: "btc",
  class: "defi",
  symbol: "BTC",
  label: "Bitcoin",
  amount: 1,
  coingeckoId: "bitcoin",
  ...(costBasisUsd === undefined ? null : { costBasisUsd }),
});

const movingQuotes = (change: number): QuoteMap => ({
  bitcoin: { usd: 100_000, change24h: change },
});

test("an empty book says so rather than reporting zero", () => {
  const result = headline(computeNetWorth([], {}));
  assert.match(result.lead, /nothing in the book/i);
  assert.equal(result.tone, "flat");
});

test("a book of stated balances does not claim a flat market", () => {
  const result = headline(computeNetWorth([cash], flatQuotes));
  // "Flat" would imply a market that did not move. There is no market.
  assert.doesNotMatch(result.lead, /quiet|flat/i);
  assert.match(result.detail ?? "", /no daily movement/i);
});

test("a move below the noise floor is reported as quiet", () => {
  const result = headline(computeNetWorth([btc()], movingQuotes(0.05)));
  assert.match(result.lead, /quiet/i);
  assert.equal(result.tone, "flat");
});

test("a real fall is never rounded into something cheerful", () => {
  const result = headline(computeNetWorth([btc()], movingQuotes(-8)));
  assert.match(result.lead, /^Down /);
  assert.equal(result.tone, "down");
  assert.doesNotMatch(result.lead, /up/i);
});

test("a fired alert outranks whatever else could be said", () => {
  const alerts: PriceAlert[] = [
    {
      id: "a",
      coingeckoId: "bitcoin",
      symbol: "BTC",
      direction: "above",
      priceUsd: 90_000,
      triggeredAt: Date.now(),
    },
  ];
  const result = headline(computeNetWorth([btc()], movingQuotes(5)), alerts);
  assert.match(result.detail ?? "", /crossed/i);
});

test("an unfired alert is not mentioned", () => {
  const alerts: PriceAlert[] = [
    {
      id: "a",
      coingeckoId: "bitcoin",
      symbol: "BTC",
      direction: "above",
      priceUsd: 200_000,
      triggeredAt: null,
    },
  ];
  const result = headline(computeNetWorth([btc()], movingQuotes(5)), alerts);
  assert.doesNotMatch(result.detail ?? "", /crossed/i);
});

test("a mover pulling against the day is described as such", () => {
  // The book is up overall, but this names a position that fell.
  const falling: Asset = {
    id: "eth",
    class: "defi",
    symbol: "ETH",
    label: "Ethereum",
    amount: 1,
    coingeckoId: "ethereum",
  };
  const quotes: QuoteMap = {
    bitcoin: { usd: 100_000, change24h: 10 },
    ethereum: { usd: 4_000, change24h: -2 },
  };
  const result = headline(computeNetWorth([btc(), falling], quotes));
  assert.equal(result.tone, "up");
  // BTC is the bigger mover in dollars, so it should be credited.
  assert.match(result.detail ?? "", /BTC/);
});

test("observations are empty when there is nothing true to say", () => {
  assert.deepEqual(observations(computeNetWorth([], {})), []);
});

test("the best position is only named when it is actually up", () => {
  const underwater = btc(150_000);
  const result = observations(computeNetWorth([underwater], flatQuotes));
  assert.ok(
    !result.some((o) => o.title === "Best position"),
    "a losing position must not be announced as the best one",
  );
  assert.ok(result.some((o) => o.title === "Weakest position"));
});

test("a single holding is not both the best and the weakest", () => {
  const winner = btc(50_000);
  const result = observations(computeNetWorth([winner], flatQuotes));
  const titles = result.map((o) => o.title);
  assert.ok(titles.includes("Best position"));
  assert.ok(!titles.includes("Weakest position"));
});

test("concentration fires on a dominant position", () => {
  const result = observations(computeNetWorth([btc(50_000), cash], flatQuotes));
  assert.ok(result.some((o) => o.title === "Concentration"));
});

test("realised gain is reported with its sign intact", () => {
  const up = observations(computeNetWorth([cash], flatQuotes), 500);
  assert.match(up.find((o) => o.title === "Realised")?.body ?? "", /\+/);

  const down = observations(computeNetWorth([cash], flatQuotes), -500);
  const body = down.find((o) => o.title === "Realised")?.body ?? "";
  assert.match(body, /−|-/);
  assert.equal(down.find((o) => o.title === "Realised")?.tone, "down");
});

test("nothing is said about a last visit on a first one", () => {
  assert.equal(sinceLastVisit([{ d: "2026-10-16", v: 100 }], 120, null), null);
});

test("a gap of a few minutes is not a last visit", () => {
  const now = Date.now();
  assert.equal(
    sinceLastVisit([{ d: "2026-10-16", v: 100 }], 120, now - 1000 * 60 * 20, now),
    null,
  );
});

test("a real gap is reported against the snapshot from before they left", () => {
  const now = new Date("2026-10-18T09:00:00").getTime();
  const lastSeen = new Date("2026-10-16T18:00:00").getTime();
  const result = sinceLastVisit(
    [
      { d: "2026-10-15", v: 100 },
      { d: "2026-10-16", v: 200 },
      // Written after they left; must not be used as the mark.
      { d: "2026-10-17", v: 900 },
    ],
    260,
    lastSeen,
    now,
  );
  // 260 against the 2026-10-16 mark of 200, not against 900.
  assert.match(result ?? "", /Up \$60/);
});

test("a move inside the noise floor reads as much the same", () => {
  const now = new Date("2026-10-18T09:00:00").getTime();
  const lastSeen = new Date("2026-10-16T18:00:00").getTime();
  const result = sinceLastVisit([{ d: "2026-10-16", v: 100_000 }], 100_050, lastSeen, now);
  assert.match(result ?? "", /much the same/i);
});

test("a fall since the last visit is reported as a fall", () => {
  const now = new Date("2026-10-18T09:00:00").getTime();
  const lastSeen = new Date("2026-10-16T18:00:00").getTime();
  const result = sinceLastVisit([{ d: "2026-10-16", v: 200 }], 150, lastSeen, now);
  assert.match(result ?? "", /^Down /);
});
