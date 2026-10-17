/**
 * Terminal chrome: the command bar, the ticker, and the pane primitive.
 *
 * The composition rule for the whole desktop layout is here, and it is
 * one trick: a grid container painted in the hairline colour with a 1px
 * gap, holding panes painted in the ground colour. The gaps *are* the
 * rules. No pane draws a border, nothing has to agree about which edge
 * owns the line, and a pane can be added or removed without leaving a
 * double rule or a gap behind it.
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useNavigation } from "../hooks/useNavigation";
import { useResponsive } from "../hooks/useResponsive";
import { useChangeFlash } from "../hooks/useInteraction";
import { useVesper } from "../hooks/useVesper";
import { pct, usd } from "../lib/format";
import { color, ease, nativeDriver, radius, space } from "../theme";
import { isDeFi, type TabId } from "../types";
import { PlusIcon } from "./icons";
import { Txt } from "./primitives";

/* ------------------------------------------------------------------ */
/* Panes                                                               */
/* ------------------------------------------------------------------ */

/**
 * The container that draws the rules.
 *
 * `direction` is the axis its children are laid along. Nest a `Grid` in a
 * `Grid` to get the two-row, two-column composition the Overview uses.
 */
export function Grid({
  direction = "row",
  children,
  style,
  flex,
}: {
  direction?: "row" | "column";
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  flex?: number;
}) {
  return (
    <View
      style={[
        styles.grid,
        { flexDirection: direction },
        flex !== undefined && { flex },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface PaneProps {
  /** Shown uppercase in the pane header. Omit for a pane with no chrome. */
  title?: string;
  /** Right-aligned content in the header: a control, a readout, a count. */
  action?: React.ReactNode;
  children: React.ReactNode;
  flex?: number;
  /** Wraps the body in its own scroller, for lists inside a fixed grid. */
  scroll?: boolean;
  /** Removes body padding, for a pane whose rows own their own insets. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
}

export function Pane({
  title,
  action,
  children,
  flex,
  scroll,
  flush,
  style,
  minHeight,
}: PaneProps) {
  const { isDesktop } = useResponsive();

  // `flex` only means something inside the desktop grid, which fills a
  // bounded viewport. On mobile the same panes sit in a scroller with
  // unbounded height, where a flex child collapses — taking every chart
  // inside it to zero measured height and rendering nothing at all.
  const sizing = isDesktop && flex !== undefined ? { flex } : null;
  // Inside a scroller the body must size to its content; everywhere else
  // it has to fill the pane, or a child asking for flex:1 — every chart —
  // has nothing to expand into and collapses to its minHeight.
  const body = (
    <View
      style={[
        styles.paneBody,
        !scroll && styles.paneBodyFill,
        flush && styles.paneBodyFlush,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View
      style={[styles.pane, sizing, minHeight !== undefined && { minHeight }, style]}
    >
      {title ? (
        <View style={styles.paneHeader}>
          <Txt variant="micro" tone="textMuted">
            {title}
          </Txt>
          {action}
        </View>
      ) : null}

      {scroll ? (
        <ScrollView style={styles.paneScroll} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Command bar                                                         */
/* ------------------------------------------------------------------ */

const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "crypto", label: "Crypto" },
  { id: "settings", label: "Settings" },
];

/**
 * The refresh countdown.
 *
 * A dot that says "live" is a claim. A ring that visibly empties toward
 * the next fetch is the same claim with its working shown, and it gives
 * the chrome a reason to move once a second without anything twitching.
 */
function RefreshRing() {
  const { prices } = useVesper();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = prices.fetchedAt ? now - prices.fetchedAt : 0;
  const remaining = Math.max(0, Math.ceil((120_000 - elapsed) / 1000));
  const progress = prices.fetchedAt ? Math.min(1, elapsed / 120_000) : 0;

  const tone =
    prices.source === "live"
      ? color.positive
      : prices.source === "cached"
        ? color.accent
        : color.textMuted;

  return (
    <View style={styles.ring}>
      <View style={styles.ringTrack}>
        <View
          style={[
            styles.ringFill,
            { backgroundColor: tone, width: `${Math.round((1 - progress) * 100)}%` },
          ]}
        />
      </View>
      <Txt variant="mono" tone="textMuted">
        {prices.loading ? "sync" : prices.fetchedAt ? `${remaining}s` : "—"}
      </Txt>
    </View>
  );
}

export function CommandBar() {
  const { tab, setTab, openSheet } = useNavigation();

  return (
    <View style={styles.commandBar}>
      <View style={styles.wordmark}>
        <View style={styles.mark} />
        <Txt variant="micro" tone="text">
          VESPER
        </Txt>
      </View>

      <View style={styles.commandNav} accessibilityRole="tablist" accessibilityLabel="Sections">
        {TABS.map(({ id, label }) => {
          const active = id === tab;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.commandTab}
            >
              <Txt variant="micro" tone={active ? "text" : "textMuted"}>
                {label}
              </Txt>
              {/* The underline is the selection, not a pill. A pill in a
                  top bar reads as a button and invites a second click. */}
              <View style={[styles.commandUnderline, active && styles.commandUnderlineActive]} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.commandRight}>
        <RefreshRing />
        <Pressable
          onPress={() => openSheet("add-asset")}
          accessibilityRole="button"
          accessibilityLabel="Add an asset"
          style={styles.commandAdd}
        >
          <PlusIcon size={14} tone={color.accentInk} strokeWidth={2.25} />
          <Txt variant="micro" tone="accentInk">
            ADD
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Ticker                                                              */
/* ------------------------------------------------------------------ */

/** One quote in the strip, flashing when its price moves. */
function TickerItem({
  symbol,
  price,
  change,
}: {
  symbol: string;
  price: number;
  change: number;
}) {
  const flash = useChangeFlash(price);
  const tone = change >= 0 ? color.positive : color.negative;

  return (
    <View
      style={[
        styles.tickerItem,
        flash === "up" && styles.tickerFlashUp,
        flash === "down" && styles.tickerFlashDown,
      ]}
    >
      <Txt variant="micro" tone="textSecondary">
        {symbol}
      </Txt>
      <Txt variant="mono" tone="text">
        {usd(price)}
      </Txt>
      <Txt variant="mono" tone={change >= 0 ? "positive" : "negative"}>
        {change >= 0 ? "▲" : "▼"} {pct(change).replace(/[+−]/, "")}
      </Txt>
      <View style={[styles.tickerRule, { backgroundColor: tone, opacity: 0.35 }]} />
    </View>
  );
}

/**
 * The scrolling price strip.
 *
 * The list is rendered twice and translated by exactly one list width, so
 * the loop point lands on an identical frame and there is no seam. The
 * whole thing is decorative, so it stops entirely under reduced motion
 * rather than scrolling slower.
 */
export function Ticker() {
  const { assets, prices, reduceMotion } = useVesper();
  const offset = useRef(new Animated.Value(0)).current;
  const [runWidth, setRunWidth] = useState(0);

  const quotes = assets.filter(isDeFi).map((asset) => ({
    symbol: asset.symbol,
    price: prices.quotes[asset.coingeckoId]?.usd ?? 0,
    change: prices.quotes[asset.coingeckoId]?.change24h ?? 0,
  }));

  useEffect(() => {
    if (reduceMotion || runWidth === 0) {
      offset.setValue(0);
      return;
    }

    offset.setValue(0);
    const animation = Animated.loop(
      Animated.timing(offset, {
        toValue: -runWidth,
        // Pace by distance, not by a fixed duration, so adding a token
        // does not speed the strip up.
        duration: runWidth * 28,
        easing: ease.standard,
        useNativeDriver: nativeDriver,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [runWidth, reduceMotion, offset]);

  if (quotes.length === 0) return <View style={styles.ticker} />;

  return (
    <View style={styles.ticker}>
      <Animated.View style={[styles.tickerRun, { transform: [{ translateX: offset }] }]}>
        <View
          style={styles.tickerRun}
          onLayout={(event) => setRunWidth(event.nativeEvent.layout.width)}
        >
          {quotes.map((quote) => (
            <TickerItem key={quote.symbol} {...quote} />
          ))}
        </View>
        {/* The duplicate run, so the loop has something to scroll into. */}
        <View style={styles.tickerRun} aria-hidden>
          {quotes.map((quote) => (
            <TickerItem key={`${quote.symbol}-echo`} {...quote} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  grid: {
    // The container's own colour shows through the 1px gaps and becomes
    // every rule in the layout.
    backgroundColor: color.hairline,
    gap: 1,
  },
  pane: {
    backgroundColor: color.ground,
    overflow: "hidden",
  },
  paneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
    minHeight: 38,
  },
  paneScroll: {
    flex: 1,
  },
  paneBody: {
    padding: space.md,
    paddingTop: space.xs,
    gap: space.sm,
  },
  paneBodyFill: {
    flex: 1,
  },
  paneBodyFlush: {
    padding: 0,
    gap: 0,
  },

  commandBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: space.md,
    gap: space.xl,
    backgroundColor: color.ground,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  wordmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  mark: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: color.accent,
    transform: [{ rotate: "45deg" }],
  },
  commandNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    flex: 1,
  },
  commandTab: {
    paddingVertical: space.xs,
    gap: space.xs,
    alignItems: "center",
  },
  commandUnderline: {
    height: 2,
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: 1,
  },
  commandUnderlineActive: {
    backgroundColor: color.accent,
  },
  commandRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  ring: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  ringTrack: {
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: color.well,
    overflow: "hidden",
  },
  ringFill: {
    height: "100%",
    borderRadius: 2,
  },
  commandAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xxs,
    backgroundColor: color.accent,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.xs,
  },

  ticker: {
    height: 34,
    backgroundColor: color.well,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
    justifyContent: "center",
    overflow: "hidden",
  },
  tickerRun: {
    flexDirection: "row",
    alignItems: "center",
  },
  tickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xxs,
  },
  tickerFlashUp: {
    backgroundColor: color.positiveSoft,
  },
  tickerFlashDown: {
    backgroundColor: color.negativeSoft,
  },
  tickerRule: {
    width: 1,
    height: 12,
    marginLeft: space.sm,
  },
});

