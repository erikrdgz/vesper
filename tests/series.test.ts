/**
 * The chart maths.
 *
 * The partial-sum case below is here because it shipped broken once: the
 * portfolio line started at a fraction of its real value and leapt when the
 * last coin's history began, which on a phone looked like a flat line with
 * a cliff at the left edge.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { areaPath, project, smoothPath } from "../src/lib/chartPath";
import { combineSeries, extent, resample, syntheticSeries, timeGrid } from "../src/lib/series";
import type { SeriesPoint } from "../src/types";

const grid = [100, 200, 300, 400];

test("resample carries the last value forward rather than interpolating", () => {
  const points: SeriesPoint[] = [
    { t: 100, v: 10 },
    { t: 300, v: 30 },
  ];
  assert.deepEqual(resample(points, grid), [10, 10, 30, 30]);
});

test("resample reports null before the first print instead of back-filling", () => {
  const points: SeriesPoint[] = [{ t: 300, v: 30 }];
  assert.deepEqual(resample(points, grid), [null, null, 30, 30]);
});

test("combineSeries sums holdings and adds the flat balance", () => {
  const result = combineSeries(
    [
      { amount: 2, points: [{ t: 100, v: 10 }] },
      { amount: 3, points: [{ t: 100, v: 100 }] },
    ],
    1_000,
    grid,
  );
  // 2*10 + 3*100 + 1000
  assert.equal(result[0]?.v, 1_320);
  assert.equal(result.length, grid.length);
});

test("combineSeries waits for every holding before emitting a point", () => {
  const result = combineSeries(
    [
      { amount: 1, points: [{ t: 100, v: 50 }] },
      // This coin's history only starts at the third slot.
      { amount: 1, points: [{ t: 300, v: 500 }] },
    ],
    0,
    grid,
  );
  // Two points, not four: the first two slots would have been partial sums
  // of 50, then a leap to 550.
  assert.equal(result.length, 2);
  assert.equal(result[0]?.t, 300);
  assert.equal(result[0]?.v, 550);
});

test("combineSeries with no history still draws the flat balance", () => {
  const result = combineSeries([{ amount: 1, points: [] }], 4_500, grid);
  assert.equal(result.length, grid.length);
  assert.ok(result.every((point) => point.v === 4_500));
});

test("the synthetic series ends exactly on the quoted price", () => {
  const points = syntheticSeries("bitcoin", "1D", 92_882.4);
  assert.ok(Math.abs(points[points.length - 1]!.v - 92_882.4) < 0.0001);
});

test("the synthetic series is deterministic for a given seed", () => {
  const now = 1_700_000_000_000;
  const a = syntheticSeries("ethereum1W", "1W", 4_000, now);
  const b = syntheticSeries("ethereum1W", "1W", 4_000, now);
  assert.deepEqual(a, b);
});

test("extent pads the range and survives a flat series", () => {
  const padded = extent([
    { t: 1, v: 10 },
    { t: 2, v: 20 },
  ]);
  assert.ok(padded.min < 10 && padded.max > 20);

  const flat = extent([
    { t: 1, v: 5 },
    { t: 2, v: 5 },
  ]);
  assert.ok(flat.max > flat.min, "a flat series must not divide by zero");
});

test("timeGrid ends on the given moment", () => {
  const now = 1_700_000_000_000;
  const points = timeGrid("1D", now);
  assert.equal(points[points.length - 1], now);
});

test("smoothPath emits a well-formed path and areaPath closes it", () => {
  const points: SeriesPoint[] = [
    { t: 1, v: 10 },
    { t: 2, v: 30 },
    { t: 3, v: 20 },
  ];
  const projection = project(points.length, { min: 0, max: 40 }, 100, 50);
  const line = smoothPath(points, projection);

  assert.ok(line.startsWith("M "));
  assert.equal(line.split(" C ").length - 1, points.length - 1);
  assert.ok(!line.includes("NaN"), "a NaN in a path renders nothing at all");

  const area = areaPath(line, 100, 50);
  assert.ok(area.endsWith("Z"));
  assert.ok(!area.includes("NaN"));
});

test("a single point does not produce a malformed path", () => {
  const projection = project(1, { min: 0, max: 10 }, 100, 50);
  const line = smoothPath([{ t: 1, v: 5 }], projection);
  assert.ok(!line.includes("NaN"));
  assert.ok(!line.includes("C"));
});
