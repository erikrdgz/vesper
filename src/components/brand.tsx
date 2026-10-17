/**
 * The Vesper identity.
 *
 * A tapered V: two strokes falling from angled tips, their inner edges
 * curving in to a notch, their outer edges running straight to a sharp
 * vertex. The asymmetry between a curved inner edge and a straight outer
 * one is what gives it weight — a V drawn with four straight lines reads
 * as a checkmark or a chevron, not a letter.
 *
 * One path, so it scales from a 16px favicon to a full-screen intro
 * without a second drawing.
 */

import Svg, { Path } from "react-native-svg";
import { StyleSheet, View } from "react-native";

import { color, space } from "../theme";
import { Txt } from "./primitives";

/**
 * The mark, on a 24 grid.
 *
 * Traced clockwise from the top-left tip: across the left stroke's angled
 * end, down its curving inner edge to the notch, up the right stroke's
 * inner edge to its tip, then straight down the outer edge to the vertex
 * and straight back up to the start.
 */
export const VESPER_PATH =
  "M2 5.2 C4.6 5.9 6.5 7.4 7.7 9.8 L11.95 14.6 L16.3 9.8 " +
  "C17.5 7.4 19.4 5.9 22 5.2 L12.2 20.6 Z";

/**
 * The same mark split along its own centre line.
 *
 * The two strokes share the notch-to-vertex edge, so drawn together they
 * are indistinguishable from `VESPER_PATH`. Apart, they let the intro
 * bring each stroke down separately and converge them on the vertex,
 * which is the motion the shape already implies.
 */
export const VESPER_STROKES = {
  left: "M2 5.2 C4.6 5.9 6.5 7.4 7.7 9.8 L11.95 14.6 L12.2 20.6 Z",
  right: "M22 5.2 C19.4 5.9 17.5 7.4 16.3 9.8 L11.95 14.6 L12.2 20.6 Z",
} as const;

/** One stroke of the mark, for the intro. */
export function VesperStroke({
  side,
  size = 24,
  tone = color.accent,
}: MarkProps & { side: keyof typeof VESPER_STROKES }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={VESPER_STROKES[side]} fill={tone} />
    </Svg>
  );
}

export interface MarkProps {
  size?: number;
  tone?: string;
}

export function VesperMark({ size = 24, tone = color.accent }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={VESPER_PATH} fill={tone} />
    </Svg>
  );
}

/** Mark plus the name, locked up. The only approved pairing. */
export function Wordmark({
  size = 18,
  tone = color.text,
  markTone = color.accent,
}: {
  size?: number;
  tone?: string;
  markTone?: string;
}) {
  return (
    <View style={styles.wordmark}>
      <VesperMark size={size} tone={markTone} />
      <Txt variant="micro" tone={tone} style={styles.wordmarkText}>
        VESPER
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  wordmarkText: {
    // Wider than the micro default: a six-letter wordmark at 11px needs
    // the air or it reads as one blurred word.
    letterSpacing: 2.2,
  },
});
