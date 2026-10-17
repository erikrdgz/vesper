/**
 * The Vesper identity.
 *
 * The mark is the 3D object flattened: the same six-sided prism you watch
 * turn on the Crypto tab, drawn face-on with its three visible faces
 * picked out. That is the whole argument for it — the identity is not
 * applied to the product, it is a drawing of the product's one piece of
 * furniture, so the favicon, the intro and the thing spinning in the
 * corner are all the same object.
 *
 * The interior lines meet off-centre, which is what stops it reading as a
 * flat hexagon: a solid turned a few degrees shows three faces of unequal
 * width, and that asymmetry is the only thing doing the work.
 */

import Svg, { Path, Polygon } from "react-native-svg";
import { StyleSheet, View } from "react-native";

import { color, space } from "../theme";
import { Txt } from "./primitives";

/** Vertices of a pointy-top hexagon on a 24 grid, radius 10, centre (12,12). */
const HEX = "12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7";

/** Where the three interior edges meet. Right of centre, so it reads turned. */
const PIVOT = { x: 14.6, y: 12.8 };

export interface MarkProps {
  size?: number;
  tone?: string;
  /** Fills the leading face, for use at small sizes where lines vanish. */
  solid?: boolean;
}

export function VesperMark({ size = 24, tone = color.accent, solid }: MarkProps) {
  const scale = size / 24;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {solid && (
        // The leading face only. At 16px the interior lines merge into a
        // smudge, so the favicon leans on silhouette plus one filled plane.
        <Path
          d={`M12 2 L${PIVOT.x} ${PIVOT.y} L12 22 L3.34 17 L3.34 7 Z`}
          fill={tone}
          fillOpacity={0.9}
        />
      )}

      <Polygon
        points={HEX}
        stroke={tone}
        strokeWidth={1.8 / scale > 2.4 ? 2.4 : 1.8}
        strokeLinejoin="round"
        fill="none"
      />

      {!solid && (
        <Path
          d={
            `M12 2 L${PIVOT.x} ${PIVOT.y} ` +
            `M${PIVOT.x} ${PIVOT.y} L3.34 17 ` +
            `M${PIVOT.x} ${PIVOT.y} L20.66 17`
          }
          stroke={tone}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.75}
        />
      )}
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
