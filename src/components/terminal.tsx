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

import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useNavigation } from "../hooks/useNavigation";
import { useResponsive } from "../hooks/useResponsive";
import { useChangeFlash } from "../hooks/useInteraction";
import { useNetWorth } from "../hooks/useNetWorth";
import { useVesper } from "../hooks/useVesper";
import { pct, usd } from "../lib/format";
import { catalogById, type CatalogEntry } from "../data/catalog";
import { color, layout, radius, space } from "../theme";
import { isDeFi, type TabId } from "../types";
import { Wordmark } from "./brand";
import { CoinMark } from "./coins";
import { PlusIcon } from "./icons";
import { Avatar, Tap, Txt } from "./primitives";

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
  { id: "watch", label: "Watch" },
  { id: "exchange", label: "Exchange" },
  { id: "wallet", label: "Wallet" },
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

function CommandTab({
  id,
  label,
  active,
  onPress,
}: {
  id: TabId;
  label: string;
  active: boolean;
  onPress: (id: TabId) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={() => onPress(id)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.commandTab}
    >
      <Txt variant="micro" tone={active ? "text" : hovered ? "textSecondary" : "textMuted"}>
        {label}
      </Txt>
      {/* The underline is the selection, not a pill. A pill in a top bar
          reads as a button and invites a second click. Hover gets a
          dimmer rule so the target is obvious before you commit. */}
      <View
        style={[
          styles.commandUnderline,
          hovered && !active && styles.commandUnderlineHover,
          active && styles.commandUnderlineActive,
        ]}
      />
    </Pressable>
  );
}

/**
 * The profile popover.
 *
 * A Modal rather than an absolutely-positioned View, so a click anywhere
 * outside dismisses it without a document-level listener that would
 * never exist on a phone.
 */
function Profile() {
  const [open, setOpen] = useState(false);
  const { setTab } = useNavigation();
  const { assets, profile, logout } = useVesper();
  const netWorth = useNetWorth();

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Your profile"
        style={styles.avatarButton}
      >
        <Avatar name={profile.name} size={28} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close profile"
        >
          <View style={styles.scrim} />
        </Pressable>

        <View style={styles.popover}>
          <View style={styles.popoverHead}>
            <Avatar name={profile.name} size={40} />
            <View style={{ flex: 1 }}>
              <Txt variant="title">{profile.name}</Txt>
              <Txt variant="caption" tone="textMuted">
                {profile.handle} · {profile.plan}
              </Txt>
            </View>
          </View>

          <View style={styles.popoverStats}>
            <View style={styles.popoverStat}>
              <Txt variant="micro" tone="textMuted">
                Net worth
              </Txt>
              <Txt variant="mono">{usd(netWorth.totalUsd)}</Txt>
            </View>
            <View style={styles.popoverStat}>
              <Txt variant="micro" tone="textMuted">
                Positions
              </Txt>
              <Txt variant="mono">{String(assets.length)}</Txt>
            </View>
          </View>

          <Pressable
            onPress={() => {
              setTab("wallet");
              setOpen(false);
            }}
            accessibilityRole="button"
            style={styles.popoverAction}
          >
            <Txt variant="bodyStrong">Open wallet</Txt>
          </Pressable>

          <Pressable
            onPress={() => {
              setOpen(false);
              logout();
            }}
            accessibilityRole="button"
            style={styles.popoverAction}
          >
            <Txt variant="bodyStrong">Log out</Txt>
          </Pressable>
          <Txt variant="caption" tone="textMuted">
            Your profile stays saved on this device. Logging out returns to the welcome screen.
          </Txt>
        </View>
      </Modal>
    </>
  );
}

export function CommandBar() {
  const { tab, setTab, openSheet } = useNavigation();

  return (
    <View style={styles.commandBar}>
      <Wordmark size={20} />

      <View style={styles.commandNav} accessibilityRole="tablist" accessibilityLabel="Sections">
        {TABS.map(({ id, label }) => (
          <CommandTab key={id} id={id} label={label} active={id === tab} onPress={setTab} />
        ))}
      </View>

      <View style={styles.commandRight}>
        <RefreshRing />
        <Profile />
        <Pressable
          onPress={() => openSheet("actions")}
          accessibilityRole="button"
          accessibilityLabel="Add, swap or set an alert"
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
/* Watchlist                                                           */
/* ------------------------------------------------------------------ */

/**
 * One followed token.
 *
 * No sparkline, deliberately. A sparkline per card would mean a history
 * request per watched token on a cold load, and following six tokens
 * would quietly triple the request count against a rate limit we are
 * already working around. Price and change is what a watch row is for;
 * the shapes live on the Crypto tab, where they are already fetched.
 */
function WatchCard({
  entry,
  price,
  change,
  held,
  active,
  onPress,
}: {
  entry: CatalogEntry;
  price: number;
  change: number;
  held: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const flash = useChangeFlash(Math.round(price * 100));
  const up = change >= 0;

  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.label}, ${usd(price)}, ${pct(change)}`}
      accessibilityState={{ selected: active }}
      scaleTo={0.97}
    >
      <View
        style={[
          styles.watchCard,
          active && styles.watchCardActive,
          flash === "up" && styles.flashUp,
          flash === "down" && styles.flashDown,
        ]}
      >
        <CoinMark symbol={entry.symbol} size={22} />
        <View style={styles.watchCopy}>
          <View style={styles.watchTop}>
            <Txt variant="micro" tone={held ? "text" : "textSecondary"}>
              {entry.symbol}
            </Txt>
            {!held && (
              // A watched token you do not own looks identical to one you
              // do without this, and the difference is the whole point.
              <View style={styles.watchOnly}>
                <Txt variant="micro" tone="textMuted">
                  WATCH
                </Txt>
              </View>
            )}
          </View>
          <View style={styles.watchBottom}>
            <Txt variant="mono" tone="text">
              {price > 0 ? usd(price) : "—"}
            </Txt>
            <Txt variant="mono" tone={up ? "positive" : "negative"}>
              {up ? "▲" : "▼"} {pct(change).replace(/[+−]/, "")}
            </Txt>
          </View>
        </View>
      </View>
    </Tap>
  );
}

/**
 * The watch rail.
 *
 * This replaced a scrolling ticker. A ticker moves, which looks alive,
 * but you cannot read a specific row without waiting for it to come
 * round, and you certainly cannot click one. A fixed row of cards is
 * worse television and a better instrument.
 *
 * It sits at the foot of the window on both breakpoints. It was at the
 * top, where it was the first thing anyone saw on every screen — six
 * prices ahead of the greeting, the balance and anything the person
 * actually came for. Followed prices are a glance, not an opening.
 */
export function Watchlist() {
  const { assets, prices, watchlist } = useVesper();
  const { setTab, openAsset, openSheet } = useNavigation();

  const heldIds = new Set(assets.filter(isDeFi).map((asset) => asset.coingeckoId));

  const rows = watchlist
    .map((id) => catalogById(id))
    .filter((entry): entry is CatalogEntry => entry !== undefined);

  if (rows.length === 0) return null;

  return (
    <View style={styles.watchBar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.watchRun}
      >
        {rows.map((entry) => {
          const quote = prices.quotes[entry.coingeckoId];
          const held = heldIds.has(entry.coingeckoId);

          return (
            <WatchCard
              key={entry.coingeckoId}
              entry={entry}
              price={quote?.usd ?? 0}
              change={quote?.change24h ?? 0}
              held={held}
              active={false}
              onPress={() => {
                if (!held) {
                  // Following something you do not hold, then clicking it,
                  // is a request to start holding it.
                  openSheet("add-asset");
                  return;
                }
                const asset = assets.filter(isDeFi).find((a) => a.coingeckoId === entry.coingeckoId);
                setTab("crypto");
                if (asset) openAsset(asset.id);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  grid: {
    // At a 1px gap the container's colour reads as every rule in the
    // layout; at a wider one it reads as the ground between blocks.
    // `layout.paneGap` is the single number that decides which.
    backgroundColor: layout.paneGap > 2 ? color.ground : color.hairline,
    gap: layout.paneGap,
  },
  pane: {
    backgroundColor: layout.paneGap > 2 ? color.card : color.ground,
    borderRadius: layout.paneRadius,
    overflow: "hidden",
  },
  paneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xs,
    minHeight: 42,
  },
  paneScroll: {
    flex: 1,
  },
  paneBody: {
    padding: space.lg,
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
  commandUnderlineHover: {
    backgroundColor: color.hairlineStrong,
  },
  avatarButton: {
    borderRadius: radius.pill,
  },
  scrim: {
    flex: 1,
    backgroundColor: color.scrim,
  },
  popover: {
    position: "absolute",
    top: 58,
    right: space.md,
    width: 264,
    padding: space.md,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: color.groundRaised,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
  },
  popoverHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  popoverStats: {
    flexDirection: "row",
    gap: space.lg,
  },
  popoverStat: {
    gap: 2,
  },
  popoverAction: {
    paddingVertical: space.xs,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    paddingTop: space.sm,
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

  watchBar: {
    backgroundColor: color.ground,
    // At the foot of the window the rail needs a line above it, or the
    // cards read as one more row of the content they are sitting under.
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  watchRun: {
    flexDirection: "row",
    gap: layout.paneGap,
    paddingHorizontal: layout.paneInset,
    paddingVertical: layout.paneInset,
  },
  watchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minWidth: 190,
    borderRadius: radius.md,
    backgroundColor: color.card,
  },
  watchCardActive: {
    backgroundColor: color.card,
  },
  watchCopy: {
    flex: 1,
    gap: 1,
  },
  watchTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  watchOnly: {
    paddingHorizontal: 4,
    borderRadius: 3,
    backgroundColor: color.hairline,
  },
  watchBottom: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.xs,
  },
  flashUp: {
    backgroundColor: color.positiveSoft,
  },
  flashDown: {
    backgroundColor: color.negativeSoft,
  },
});

