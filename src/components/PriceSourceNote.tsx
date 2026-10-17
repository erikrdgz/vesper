/**
 * Where the numbers came from.
 *
 * This component is the product's argument in one line. Every dashboard
 * can show a price; almost none will tell you that the price is four hours
 * old because the API refused them. Vesper says so, in the same place every
 * time, and the dot colour means the same thing on every screen.
 */

import { StyleSheet, View } from "react-native";

import { useVesper } from "../hooks/useVesper";
import { color, radius, space } from "../theme";
import type { PriceSource } from "../types";
import { Txt } from "./primitives";

const COPY: Record<PriceSource, { dot: string; label: string; detail: string }> = {
  live: {
    dot: color.positive,
    label: "Live",
    detail: "Prices straight from CoinGecko.",
  },
  cached: {
    dot: color.accent,
    label: "Cached",
    detail: "The last prices we managed to fetch.",
  },
  fallback: {
    dot: color.textMuted,
    label: "Indicative",
    detail: "Seeded prices. Nothing live has reached us yet.",
  },
};

export function PriceSourceNote({ compact }: { compact?: boolean }) {
  const { prices } = useVesper();
  const copy = COPY[prices.source];

  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <View style={[styles.dot, { backgroundColor: copy.dot }]} />
        <Txt variant="micro" tone="textSecondary">
          {copy.label}
        </Txt>
      </View>

      {!compact && (
        <Txt variant="caption" tone="textSecondary" style={styles.detail}>
          {prices.error ?? copy.detail}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.xs,
    backgroundColor: color.well,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detail: {
    flex: 1,
    minWidth: 160,
  },
});
