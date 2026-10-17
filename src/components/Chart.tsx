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

import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";

import { areaPath, project, smoothPath } from "../lib/chartPath";
import { extent } from "../lib/series";
import { color, radius, space, type } from "../theme";
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
}

export function AreaChart({
  points,
  width,
  height,
  tone = color.accent,
  gridLines = 4,
  marker = true,
  dimmed,
}: AreaChartProps) {
  const geometry = useMemo(() => {
    if (points.length < 2 || width <= 0 || height <= 0) return null;

    const bounds = extent(points);
    const projection = project(points.length, bounds, width, height);
    const line = smoothPath(points, projection);

    return {
      line,
      area: areaPath(line, width, height),
      lastX: projection.x(points.length - 1),
      lastY: projection.y(points[points.length - 1]!.v),
    };
  }, [points, width, height]);

  if (!geometry) {
    return <View style={{ width, height }} />;
  }

  // A stable-enough id. Two charts on one screen with the same gradient id
  // would have the second silently adopt the first's colours.
  const fillId = `area-${tone.replace(/[^a-z0-9]/gi, "")}-${Math.round(width)}`;

  return (
    <View style={{ width, height, opacity: dimmed ? 0.45 : 1 }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tone} stopOpacity="0.34" />
            <Stop offset="0.65" stopColor={tone} stopOpacity="0.06" />
            <Stop offset="1" stopColor={tone} stopOpacity="0" />
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

        <Path d={geometry.area} fill={`url(#${fillId})`} />

        <Path d={geometry.line} stroke={tone} strokeOpacity={0.1} strokeWidth={9} fill="none" />
        <Path d={geometry.line} stroke={tone} strokeOpacity={0.22} strokeWidth={5} fill="none" />
        <Path
          d={geometry.line}
          stroke={tone}
          strokeWidth={2.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {marker && (
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
      <Path
        d={line}
        stroke={tone}
        strokeWidth={1.75}
        fill="none"
        strokeLinecap="round"
        translateY={2}
      />
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
