/**
 * Turning a series into an SVG path.
 *
 * Pure and separate from the component so the curve maths can be asserted.
 * A chart that is off by a pixel is invisible; a chart whose path string is
 * malformed renders as nothing at all, and "nothing at all" is hard to
 * notice in a screenshot review.
 */

import type { SeriesPoint } from "../types";

export interface Projection {
  /** Series index -> x in view units. */
  x: (index: number) => number;
  /** Value -> y in view units. Inverted, since SVG y grows downward. */
  y: (value: number) => number;
}

/** Build the index->x and value->y mappings for a plot box. */
export function project(
  count: number,
  bounds: { min: number; max: number },
  width: number,
  height: number,
): Projection {
  const span = bounds.max - bounds.min || 1;
  const step = count > 1 ? width / (count - 1) : 0;
  return {
    x: (index) => index * step,
    y: (value) => height - ((value - bounds.min) / span) * height,
  };
}

/**
 * A smoothed path through the points, as Catmull-Rom converted to cubic
 * beziers.
 *
 * `tension` of 0 gives the standard uniform Catmull-Rom. Raising it flattens
 * the control handles, which matters on price data: a true spline through
 * noisy intraday points overshoots at every local peak and draws prices
 * that never printed.
 */
export function smoothPath(points: SeriesPoint[], projection: Projection, tension = 0.35): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${projection.x(0)} ${projection.y(points[0]!.v)}`;

  const px = (i: number) => projection.x(Math.min(Math.max(i, 0), points.length - 1));
  const py = (i: number) =>
    projection.y(points[Math.min(Math.max(i, 0), points.length - 1)]!.v);

  const scale = (1 - tension) / 6;
  let path = `M ${px(0).toFixed(2)} ${py(0).toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const c1x = px(i) + (px(i + 1) - px(i - 1)) * scale;
    const c1y = py(i) + (py(i + 1) - py(i - 1)) * scale;
    const c2x = px(i + 1) - (px(i + 2) - px(i)) * scale;
    const c2y = py(i + 1) - (py(i + 2) - py(i)) * scale;
    path +=
      ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}` +
      ` ${c2x.toFixed(2)} ${c2y.toFixed(2)}` +
      ` ${px(i + 1).toFixed(2)} ${py(i + 1).toFixed(2)}`;
  }

  return path;
}

/** The same path closed down to the baseline, for the gradient fill. */
export function areaPath(line: string, width: number, height: number): string {
  if (!line) return "";
  return `${line} L ${width.toFixed(2)} ${height.toFixed(2)} L 0 ${height.toFixed(2)} Z`;
}
