/**
 * Recording what the book was worth.
 *
 * Pure, so the upsert rule can be asserted: one row per day, the last
 * write of the day wins, and the list stays bounded. Vesper has no
 * server, so this is the only history it will ever genuinely own — and
 * precisely because it is the honest one, it must not drift.
 */

import type { Snapshot, SeriesPoint } from "../types";

/** How many days of history to keep. A quarter is enough to read. */
export const SNAPSHOT_LIMIT = 90;

/** Local YYYY-MM-DD, not UTC: a day boundary should be the user's. */
export function dayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Write today's value, replacing any earlier write for the same day.
 *
 * Returns the original array unchanged when nothing moved, so the
 * caller's effect does not loop: a new array every render would
 * re-trigger the save that produced it.
 */
export function recordSnapshot(
  snapshots: Snapshot[],
  valueUsd: number,
  today = dayKey(),
): Snapshot[] {
  if (!Number.isFinite(valueUsd)) return snapshots;

  const last = snapshots[snapshots.length - 1];
  if (last?.d === today) {
    // Rewriting the same day with a value that rounds the same is a
    // no-op; prices tick every two minutes and we are not interested in
    // the cents.
    if (Math.round(last.v) === Math.round(valueUsd)) return snapshots;
    const next = snapshots.slice(0, -1);
    next.push({ d: today, v: valueUsd });
    return next;
  }

  return [...snapshots, { d: today, v: valueUsd }].slice(-SNAPSHOT_LIMIT);
}

/** Snapshots as chart points, at local noon so a day reads as a day. */
export function snapshotSeries(snapshots: Snapshot[]): SeriesPoint[] {
  return snapshots
    .map((snapshot) => {
      const parts = snapshot.d.split("-").map(Number);
      const [year, month, day] = parts;
      if (year === undefined || month === undefined || day === undefined) return null;
      return { t: new Date(year, month - 1, day, 12).getTime(), v: snapshot.v };
    })
    .filter((point): point is SeriesPoint => point !== null);
}
