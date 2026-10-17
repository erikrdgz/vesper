/**
 * The charts.
 *
 * react-native-svg throughout, no charting library. That is partly the
 * brief and partly that every chart library worth using is web-only, and
 * the point of this build is that the same components would run on a phone.
 *
 * The glow is three strokes of the same path at decreasing width and
 * increasing opacity, rather than an SVG blur filter. Filters are patchy
 * across react-native-svg's native backends, and the stacked-stroke trick
 * renders identically everywhere.
 */

import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Line, Path, Stop } from "react-native-svg";

import { useVesper } from "../hooks/useVesper";
import { areaPath, estimatePathLength, project, smoothPath } from "../lib/chartPath";
import { extent } from "../lib/series";
import { color, duration, radius, space, type } from "../theme";
import type { SeriesPoint } from "../types";
import { Txt } from "./primitives";

interface AreaChartProps {
  points: SeriesPoint[];
  width: number;
  height: number;
  /** Line colour. Defaults to the accent. */
  tone?: string;
  /** Horizontal rules behind the line. */
  gridLines?: number;
  /** A dot on the final point, as in the reference. */
  marker?: boolean;
  /** Dims the whole chart while a refetch is in flight. */
  dimmed?: boolean;
  /** Draws the line on from left to right when the data first arrives. */
  animate?: boolean;
}


/**
 * The draw-on.
 *
 * `strokeDasharray` is set to the whole path length and the offset walks
 * to zero, so the line appears to be drawn left to right rather than
 * fading in as a finished object. It runs once per distinct path: changing
 * range redraws, a price tick does not, because a chart that redraws every
 * two minutes is a chart nobody can read.
 *
 * Progress is held in state rather than an `Animated.Value` because
 * react-native-svg's dash props are plain numbers on the native backends.
 * It is one short burst of renders on a small component, once.
 */
function useDrawOn(length: number, enabled: boolean): number {
  const { reduceMotion } = useVesper();
  const [progress, setProgress] = useState(enabled && !reduceMotion ? 0 : 1);
  const signature = Math.round(length);

  useEffect(() => {
    if (!enabled || reduceMotion || signature === 0) {
      setProgress(1);
      return;
    }

    setProgress(0);
    const started = Date.now();
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - started;
      const t = Math.min(1, elapsed / duration.rise);
      // Ease out, so the line decelerates into its final point rather
      // than stopping dead.
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [signature, enabled, reduceMotion]);

  return progress;
}

export function AreaChart({
  points,
  width,
  height,
  tone = color.accent,
  gridLines = 4,
  marker = true,
  dimmed,
  animate = true,
}: AreaChartProps) {
  const geometry = useMemo(() => {
    if (points.length < 2 || width <= 0 || height <= 0) return null;

    const bounds = extent(points);
    const projection = project(points.length, bounds, width, height);
    const line = smoothPath(points, projection);

    return {
      line,
      area: areaPath(line, width, height),
      length: estimatePathLength(points, projection),
      lastX: projection.x(points.length - 1),
      lastY: projection.y(points[points.length - 1]!.v),
    };
  }, [points, width, height]);

  // Hooks cannot sit behind the early return below, so the draw-on is
  // computed from a zero length when there is nothing to draw.
  const progress = useDrawOn(geometry?.length ?? 0, animate);

  if (!geometry) {
    return <View style={{ width, height }} />;
  }

  const drawing = progress < 1;
  const reveal = {
    dash: drawing
      ? {
          strokeDasharray: [geometry.length, geometry.length],
          strokeDashoffset: geometry.length * (1 - progress),
        }
      : {},
    // The fill lags the line, so the area arrives under a finished stroke.
    fill: Math.max(0, progress * 1.6 - 0.6),
    markerVisible: progress > 0.98,
  };

  // A stable-enough id. Two charts on one screen with the same gradient id
  // would have the second silently adopt the first's colours.
  const fillId = `area-${tone.replace(/[^a-z0-9]/gi, "")}-${Math.round(width)}`;

  return (
    <View style={{ width, height, opacity: dimmed ? 0.45 : 1 }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tone} stopOpacity="0.38" />
            <Stop offset="0.55" stopColor={tone} stopOpacity="0.12" />
            <Stop offset="1" stopColor={tone} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {Array.from({ length: gridLines }, (_, i) => {
          const y = (height / gridLines) * (i + 1) - height / gridLines / 2;
          return (
            <Line
              key={i}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={color.hairline}
              strokeWidth={1}
            />
          );
        })}

        <Path d={geometry.area} fill={`url(#${fillId})`} opacity={reveal.fill} />

        {/* The glow is three strokes of one path at decreasing width.
            An feGaussianBlur filter would be one element, but filter
            support is patchy across react-native-svg's native backends
            and this renders identically everywhere. */}
        <Path
          d={geometry.line}
          stroke={tone}
          strokeOpacity={0.1}
          strokeWidth={9}
          fill="none"
          {...reveal.dash}
        />
        <Path
          d={geometry.line}
          stroke={tone}
          strokeOpacity={0.22}
          strokeWidth={5}
          fill="none"
          {...reveal.dash}
        />
        <Path
          d={geometry.line}
          stroke={tone}
          strokeWidth={2.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...reveal.dash}
        />

        {marker && reveal.markerVisible && (
          <>
            <Circle cx={geometry.lastX} cy={geometry.lastY} r={7} fill={tone} opacity={0.18} />
            <Circle
              cx={geometry.lastX}
              cy={geometry.lastY}
              r={3.5}
              fill={tone}
              stroke={color.ground}
              strokeWidth={2}
            />
          </>
        )}
      </Svg>
    </View>
  );
}

/** The small inline version, for holding rows. No grid, no marker, no fill gradient. */
export function Sparkline({
  points,
  width = 64,
  height = 28,
  tone = color.positive,
}: {
  points: SeriesPoint[];
  width?: number;
  height?: number;
  tone?: string;
}) {
  const line = useMemo(() => {
    if (points.length < 2) return "";
    // Inset by the stroke's half-width so the curve is not clipped at the
    // top and bottom of its own box.
    const projection = project(points.length, extent(points), width, height - 4);
    return smoothPath(points, projection, 0.5);
  }, [points, width, height]);

  if (!line) return <View style={{ width, height }} />;

  return (
    <Svg width={width} height={height}>
      <G y={2}>
        <Path d={line} stroke={tone} strokeWidth={1.75} fill="none" strokeLinecap="round" />
      </G>
    </Svg>
  );
}

/**
 * The allocation bar: one stacked rule showing what the book is made of.
 *
 * A donut would need a legend to be readable at this size, and a legend is
 * four more rows of chrome. A stacked bar can carry its own labels.
 */
export function AllocationBar({
  segments,
  width,
}: {
  segments: { label: string; weight: number; tone: string }[];
  width: number;
}) {
  const visible = segments.filter((segment) => segment.weight > 0);
  const total = visible.reduce((sum, segment) => sum + segment.weight, 0) || 1;

  return (
    <View style={{ width }}>
      <View style={styles.allocationTrack}>
        {visible.map((segment) => (
          <View
            key={segment.label}
            style={{
              flex: segment.weight / total,
              backgroundColor: segment.tone,
            }}
          />
        ))}
      </View>
      <View style={styles.allocationLegend}>
        {visible.map((segment) => (
          <View key={segment.label} style={styles.allocationItem}>
            <View style={[styles.allocationDot, { backgroundColor: segment.tone }]} />
            <Txt variant="caption" tone="textSecondary">
              {segment.label}
            </Txt>
            <Txt variant="caption" tone="text">
              {Math.round((segment.weight / total) * 100)}%
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Monthly in/out bars for the Analytics tab. */
export function BarRow({
  values,
  width,
  height = 64,
  tone = color.accent,
}: {
  values: { label: string; value: number }[];
  width: number;
  height?: number;
  tone?: string;
}) {
  const max = Math.max(...values.map((entry) => Math.abs(entry.value)), 1);
  const gap = space.sm;
  // Capped, or a short list in a wide column draws squares rather than bars.
  const barWidth = Math.min(
    48,
    Math.max(4, (width - gap * (values.length - 1)) / values.length),
  );

  return (
    <View style={{ width }}>
      <View style={[styles.barRow, { height, gap }]}>
        {values.map((entry) => (
          <View
            key={entry.label}
            style={{
              width: barWidth,
              height: Math.max(3, (Math.abs(entry.value) / max) * height),
              backgroundColor: tone,
              opacity: 0.25 + (Math.abs(entry.value) / max) * 0.75,
              borderRadius: radius.xs,
            }}
          />
        ))}
      </View>
      <View style={[styles.barRow, { gap, marginTop: space.xs, alignItems: "flex-start" }]}>
        {values.map((entry) => (
          <View key={entry.label} style={{ width: barWidth, alignItems: "center" }}>
            <Txt variant="micro" tone="textMuted" style={type.micro}>
              {entry.label}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  allocationTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: color.well,
    gap: 2,
  },
  allocationLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginTop: space.sm,
  },
  allocationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  allocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
});
