/**
 * A holding as a card.
 *
 * The wallet used to list tokens as rows, which is what a spreadsheet
 * does. A wallet holds cards — so each token gets one, in its own neon,
 * and they stack with the one below showing just enough of itself to be
 * recognised and tapped. Tapping brings a card to the front.
 *
 * Each card carries the token's mark, its symbol, what it is worth and
 * what you hold. The quantity is set in the position a card number
 * occupies on a real one, because that is where the eye goes looking.
 */

import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useVesper } from "../hooks/useVesper";
import { pct, tokenAmount, usd, usdSigned } from "../lib/format";
import { duration, ease, nativeDriver, radius, shadow, space, spring, type } from "../theme";
import type { DeFiAsset, ValuedAsset } from "../types";
import { CoinMark } from "./coins";
import { Txt } from "./primitives";

/**
 * Each token's card, as a gradient and an ink.
 *
 * Darker and more saturated than the icon colours: a card is a large
 * flat area, and the tint that reads well at 20px becomes fluorescent
 * at 300. The ink is chosen per card for contrast, not picked once.
 */
const CARD: Record<string, { from: string; to: string; ink: string }> = {
  BTC: { from: "#FFB45C", to: "#B4631A", ink: "#2A1403" },
  ETH: { from: "#A9B4FF", to: "#4C56C9", ink: "#0C1035" },
  SOL: { from: "#4FF5B8", to: "#128F66", ink: "#03221A" },
  LINK: { from: "#7FB8FF", to: "#1C5FC4", ink: "#04142F" },
  ADA: { from: "#7FB2FF", to: "#1E52B8", ink: "#04122E" },
  DOT: { from: "#FF8FCB", to: "#B5257E", ink: "#300A20" },
  AVAX: { from: "#FF9292", to: "#C22F2F", ink: "#300707" },
  MATIC: { from: "#C6A2FF", to: "#6D35C9", ink: "#1C0A33" },
};

const DEFAULT_CARD = { from: "#D6FF4B", to: "#6F9C0F", ink: "#0B0E14" };

export const cardSkin = (symbol: string) => CARD[symbol] ?? DEFAULT_CARD;

interface TokenCardProps {
  entry: ValuedAsset;
  /** Raised and fully legible when true. */
  active: boolean;
  onPress: () => void;
  /** How far this card is pulled up over the one before it. Stack only. */
  overlap: number;
  index: number;
  /**
   * `stack` is the hand of cards a phone gets; `rail` is the row a window
   * has the width for, where every card is already face up.
   */
  layout?: "stack" | "rail";
  /** The card at the front of the hand. It gets the light. */
  glow?: boolean;
}

export function TokenCard({
  entry,
  active,
  onPress,
  overlap,
  index,
  layout = "stack",
  glow,
}: TokenCardProps) {
  const { reduceMotion } = useVesper();
  const asset = entry.asset as DeFiAsset;
  const skin = cardSkin(asset.symbol);
  const rail = layout === "rail";

  const hover = useRef(new Animated.Value(0)).current;
  const raise = useRef(new Animated.Value(active ? 1 : 0)).current;

  function to(value: number) {
    if (reduceMotion) {
      hover.setValue(value);
      return;
    }
    Animated.timing(hover, {
      toValue: value,
      duration: duration.short,
      easing: ease.standard,
      useNativeDriver: nativeDriver,
    }).start();
  }

  /**
   * Selection is a spring, not a cut.
   *
   * Picking a card used to move it to the end of the list, which is a
   * reorder: every card below it jumped a slot in one frame and the one
   * you picked appeared somewhere else. Nothing moves in the layout now
   * — the chosen card is painted over its neighbours and rises under a
   * spring, which is what a card does when a hand pulls it out.
   */
  useEffect(() => {
    if (reduceMotion) {
      raise.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.spring(raise, {
      toValue: active ? 1 : 0,
      ...spring.press,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [active, raise, reduceMotion]);

  const muted = `rgba(${hexToRgb(skin.ink)}, 0.62)`;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => to(1)}
      onHoverOut={() => to(0)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${asset.label}, ${usd(entry.valueUsd)}`}
      // In the stack, only the first card sits flush and every other one
      // climbs over its predecessor — that overlap is what makes it read
      // as a stack. On the rail they sit side by side, and the selected
      // card is lifted above its neighbours rather than reordered.
      style={[
        rail ? styles.railSlot : styles.slot,
        !rail && index > 0 && { marginTop: -overlap },
        { zIndex: active ? 50 : index },
      ]}
    >
      <Animated.View
        style={[
          styles.card,
          shadow.lifted,
          // The front card's own colour, thrown onto the ground under
          // it. One card glows at a time: a deck where every card is lit
          // is a deck with no front.
          glow && {
            shadowColor: skin.from,
            shadowOpacity: 0.5,
            shadowRadius: 34,
            shadowOffset: { width: 0, height: 14 },
            elevation: 16,
          },
          {
            transform: [
              {
                translateY: Animated.add(
                  hover.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }),
                  raise.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }),
                ),
              },
              {
                scale: raise.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={[skin.from, skin.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.face}
        >
          <View style={styles.faceTop}>
            <View style={styles.markRow}>
              {/* A dark medallion with the token's mark in its own light
                  tone, the way a card carries a chip. Drawn in the card's
                  ink it was a black silhouette on a bright face. */}
              <CoinMark symbol={asset.symbol} size={26} disc={skin.ink} ink={skin.from} />
              <Txt variant="title" style={{ color: skin.ink }}>
                {asset.label}
              </Txt>
            </View>
            <Txt variant="micro" style={{ color: muted }}>
              {asset.symbol}
            </Txt>
          </View>

          {/* Everything below the fold only shows on the front card. */}
          <View style={styles.faceBody}>
            <Txt variant="mono" style={{ color: muted }}>
              {tokenAmount(asset.amount, asset.symbol)}
            </Txt>
            <View style={styles.faceBottom}>
              <Txt variant="display" style={[styles.value, { color: skin.ink }]}>
                {usd(entry.valueUsd)}
              </Txt>
              {entry.gainPct !== null && (
                <View style={[styles.pill, { backgroundColor: `rgba(${hexToRgb(skin.ink)}, 0.14)` }]}>
                  <Txt variant="caption" style={{ color: skin.ink }}>
                    {usdSigned(entry.gainUsd ?? 0)} · {pct(entry.gainPct)}
                  </Txt>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

/** "#2A1403" -> "42, 20, 3". For rgba() tints off a card's own ink. */
function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const value = parseInt(clean.length === 3 ? clean.replace(/./g, "$&$&") : clean, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

/** Height of a card, and how much of the one below stays visible. */
export const CARD_HEIGHT = 168;
export const CARD_PEEK = 62;
/** A card on the rail, where width is the thing in short supply. */
export const CARD_WIDTH = 252;

const styles = StyleSheet.create({
  slot: {
    width: "100%",
  },
  railSlot: {
    width: CARD_WIDTH,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  face: {
    flex: 1,
    padding: space.md,
    justifyContent: "space-between",
  },
  faceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  markRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    flex: 1,
  },
  faceBody: {
    gap: space.xxs,
  },
  faceBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.sm,
    flexWrap: "wrap",
  },
  value: {
    ...(type.display as object),
  },
  pill: {
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
});
