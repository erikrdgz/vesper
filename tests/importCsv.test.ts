/**
 * Reading a spreadsheet back in.
 *
 * Import is where a silently-dropped digit becomes a wrong balance that
 * nobody questions, so the rule throughout is that a row either parses
 * completely or is reported as skipped. Nothing is guessed.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseLine, parsePositions } from "../src/lib/importCsv";
import { computeNetWorth } from "../src/lib/netWorth";
import { positionsCsv } from "../src/lib/exportCsv";
import { isDeFi, isTradFi, type Asset, type QuoteMap } from "../src/types";

/** `Asset` is a union, so a stated balance needs narrowing to read. */
function balanceOf(asset: Asset | undefined): number | null {
  return asset && isTradFi(asset) ? asset.balanceUsd : null;
}

test("a quoted comma does not split the cell", () => {
  assert.deepEqual(parseLine('Chase,"Vanguard, Total Market",12000'), [
    "Chase",
    "Vanguard, Total Market",
    "12000",
  ]);
});

test("a doubled quote inside a quoted cell is a literal quote", () => {
  assert.deepEqual(parseLine('"He said ""hi""",2'), ['He said "hi"', "2"]);
});

test("an exported book reads back as the same positions", () => {
  const quotes: QuoteMap = { bitcoin: { usd: 100_000, change24h: 0 } };
  const original: Asset[] = [
    {
      id: "a",
      class: "tradfi",
      kind: "cash",
      institution: "Chase",
      label: "Chase Checking",
      balanceUsd: 4_500,
    },
    {
      id: "b",
      class: "defi",
      symbol: "BTC",
      label: "Bitcoin",
      amount: 0.42,
      coingeckoId: "bitcoin",
      costBasisUsd: 24_180,
    },
  ];

  const { assets, skipped } = parsePositions(positionsCsv(computeNetWorth(original, quotes)));
  assert.deepEqual(skipped, []);
  assert.equal(assets.length, 2);

  const btc = assets.find((asset) => isDeFi(asset) && asset.symbol === "BTC");
  assert.ok(btc && isDeFi(btc));
  assert.equal(btc.amount, 0.42);
  assert.equal(btc.costBasisUsd, 24_180);
});

test("the TOTAL row the export writes is not read back as a position", () => {
  const quotes: QuoteMap = {};
  const csv = positionsCsv(
    computeNetWorth(
      [
        {
          id: "a",
          class: "tradfi",
          kind: "cash",
          institution: "Chase",
          label: "Chase Checking",
          balanceUsd: 4_500,
        },
      ],
      quotes,
    ),
  );
  const { assets } = parsePositions(csv);
  assert.equal(assets.length, 1);
  assert.ok(!assets.some((asset) => asset.label === "TOTAL"));
});

test("columns can be in any order", () => {
  const csv = ["Cost USD,Kind,Name,Value USD", "9400,brokerage,Vanguard,12000"].join("\n");
  const { assets } = parsePositions(csv);
  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.label, "Vanguard");
  assert.equal(assets[0]?.costBasisUsd, 9_400);
});

test("a bad number is skipped with a reason rather than imported as zero", () => {
  const csv = ["Name,Kind,Value USD", "Mystery,cash,not-a-number"].join("\n");
  const { assets, skipped } = parsePositions(csv);
  assert.equal(assets.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0]!, /value is missing or not a number/i);
});

test("an unknown token is skipped by name", () => {
  const csv = ["Name,Kind,Symbol,Quantity", "Dogecoin,Crypto,DOGE,100"].join("\n");
  const { assets, skipped } = parsePositions(csv);
  assert.equal(assets.length, 0);
  assert.match(skipped[0]!, /does not know the token "DOGE"/);
});

test("an unknown kind is skipped rather than guessed at", () => {
  const csv = ["Name,Kind,Value USD", "Something,pension,1000"].join("\n");
  const { assets, skipped } = parsePositions(csv);
  assert.equal(assets.length, 0);
  assert.match(skipped[0]!, /not a kind Vesper recognises/i);
});

test("a negative credit balance is stored positive", () => {
  // The export writes credit as a negative value; the model holds it
  // positive and negates at valuation time.
  const csv = ["Name,Kind,Value USD", "Sapphire,credit,-2310.44"].join("\n");
  const { assets } = parsePositions(csv);
  assert.equal(balanceOf(assets[0]), 2310.44);
});

test("cash is never given a cost basis even if the file has one", () => {
  const csv = ["Name,Kind,Value USD,Cost USD", "Chase,cash,4500,4500"].join("\n");
  const { assets } = parsePositions(csv);
  assert.equal(assets[0]?.costBasisUsd, undefined);
});

test("currency formatting in the file is tolerated", () => {
  const csv = ["Name,Kind,Value USD", 'Chase,cash,"$4,500.00"'].join("\n");
  const { assets } = parsePositions(csv);
  assert.equal(balanceOf(assets[0]), 4500);
});

test("a file with no Name column says so rather than returning nothing", () => {
  const { assets, skipped } = parsePositions("Kind,Value USD\ncash,100");
  assert.equal(assets.length, 0);
  assert.equal(skipped.length, 1);
});

test("an empty file is not an error", () => {
  assert.deepEqual(parsePositions(""), { assets: [], skipped: [] });
});

test("imported ids are unique", () => {
  const csv = ["Name,Kind,Value USD", "A,cash,1", "B,cash,2", "C,cash,3"].join("\n");
  const { assets } = parsePositions(csv);
  assert.equal(new Set(assets.map((asset) => asset.id)).size, 3);
});
