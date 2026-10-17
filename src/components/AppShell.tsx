/**
 * The frame: one set of screens, two sets of chrome.
 *
 * Desktop is a terminal. A command bar carries the navigation, the watch
 * rail runs along the bottom, and the window between them is a grid of
 * panes that fills the viewport and does not scroll as a page — panes that
 * need more room scroll inside themselves, the way a real terminal's
 * blotter does. There is no sidebar and no max-width: the content is the
 * instrument, not an article about one.
 *
 * Mobile is a phone app. The same panes stack into one scrolling column
 * above the watch rail and a bottom tab bar with the add button raised out
 * of it.
 *
 * The rail is at the bottom on both, and that is the whole reason this
 * comment changed: it used to be the first thing on the screen, so every
 * screen opened on six prices nobody asked for and the greeting came
 * second. Prices are ambient — they belong in the chrome at the foot of
 * the window, where a ticker has always lived.
 */

import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useNavigation } from "../hooks/useNavigation";
import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { color, layout, shadow, space } from "../theme";
import type { TabId } from "../types";
import {
  AnalyticsIcon,
  CryptoIcon,
  HomeIcon,
  PlusIcon,
  SwapIcon,
  WalletIcon,
  WatchIcon,
  type IconProps,
} from "./icons";
import { CommandBar, Grid, Watchlist } from "./terminal";
import { Txt } from "./primitives";

/**
 * `short` is what the bottom bar uses.
 *
 * Four 11px uppercase labels plus the raised button do not fit across a
 * 375px phone: "OVERVIEW" and "ANALYTICS" ran into each other with no
 * gap at all. The command bar has the room for the full words.
 */
const TABS: {
  id: TabId;
  label: string;
  short: string;
  Icon: (props: IconProps) => React.ReactElement;
}[] = [
  { id: "home", label: "Overview", short: "Home", Icon: HomeIcon },
  { id: "analytics", label: "Analytics", short: "Charts", Icon: AnalyticsIcon },
  { id: "crypto", label: "Crypto", short: "Crypto", Icon: CryptoIcon },
  { id: "watch", label: "Watch", short: "Watch", Icon: WatchIcon },
  { id: "exchange", label: "Exchange", short: "Swap", Icon: SwapIcon },
  { id: "wallet", label: "Wallet", short: "Wallet", Icon: WalletIcon },
];

/**
 * The bottom bar carries four of the six.
 *
 * Six labels plus the raised button do not fit across a phone. Analytics
 * and Exchange come off: Analytics is a reading screen you go to
 * deliberately and is linked from the overview, and Exchange is one of
 * the four things the raised button already opens. What is left is the
 * wallet shape — balances, holdings, watchlist, you.
 */
const MOBILE_TABS = TABS.filter((tab) => tab.id !== "analytics" && tab.id !== "exchange");

/* ------------------------------------------------------------------ */
/* Screen scaffolding                                                  */
/* ------------------------------------------------------------------ */

/**
 * What a screen renders into.
 *
 * On desktop the children are a `Grid` that fills the remaining height.
 * On mobile they are a column that scrolls. Screens hand over the same
 * panes either way; only this decides what happens to them.
 */
export function Screen({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    /**
     * Fills the viewport when the content fits, scrolls when it does
     * not.
     *
     * It was a plain View, on the theory that a terminal does not
     * scroll. That holds right up until a screen gains a pane — adding
     * the reading to Analytics squeezed the right column until
     * Allocation and Movers collapsed to empty headers, because flex
     * children in a bounded box shrink rather than overflow. A grid
     * that silently eats its own content is worse than one that
     * scrolls.
     */
    return (
      <ScrollView
        style={styles.desktopScreen}
        contentContainerStyle={styles.desktopContent}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.mobileScroll}
      contentContainerStyle={styles.mobileContent}
      showsVerticalScrollIndicator={false}
    >
      <Grid direction="column">{children}</Grid>
    </ScrollView>
  );
}

/**
 * A row of panes on desktop that becomes a stack on mobile.
 *
 * Screens express composition once; the breakpoint is resolved here.
 */
export function Row({ children, flex }: { children: React.ReactNode; flex?: number }) {
  const { isDesktop } = useResponsive();
  return (
    <Grid direction={isDesktop ? "row" : "column"} flex={isDesktop ? flex : undefined}>
      {children}
    </Grid>
  );
}

/** A column of panes, on both breakpoints. */
export function Column({ children, flex }: { children: React.ReactNode; flex?: number }) {
  const { isDesktop } = useResponsive();
  return (
    <Grid direction="column" flex={isDesktop ? flex : undefined}>
      {children}
    </Grid>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile chrome                                                       */
/* ------------------------------------------------------------------ */

function TabBar() {
  const { tab, setTab, openSheet } = useNavigation();
  const left = MOBILE_TABS.slice(0, 2);
  const right = MOBILE_TABS.slice(2);

  return (
    <View style={styles.tabBar} accessibilityRole="tablist" accessibilityLabel="Sections">
      {left.map(({ id, label, short, Icon }) => (
        <TabButton
          key={id}
          id={id}
          label={label}
          short={short}
          Icon={Icon}
          active={id === tab}
          onPress={setTab}
        />
      ))}

      <Pressable
        onPress={() => openSheet("actions")}
        accessibilityRole="button"
        accessibilityLabel="Add, swap or set an alert"
        style={[styles.fab, shadow.glow]}
      >
        <PlusIcon size={24} tone={color.accentInk} strokeWidth={2.25} />
      </Pressable>

      {right.map(({ id, label, short, Icon }) => (
        <TabButton
          key={id}
          id={id}
          label={label}
          short={short}
          Icon={Icon}
          active={id === tab}
          onPress={setTab}
        />
      ))}
    </View>
  );
}

function TabButton({
  id,
  label,
  short,
  Icon,
  active,
  onPress,
}: {
  id: TabId;
  label: string;
  short: string;
  Icon: (props: IconProps) => React.ReactElement;
  active: boolean;
  onPress: (id: TabId) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(id)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={styles.tabButton}
    >
      <Icon size={22} tone={active ? color.accent : color.textMuted} />
      <Txt variant="micro" tone={active ? "accent" : "textMuted"} numberOfLines={1}>
        {short}
      </Txt>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useResponsive();
  const { hydrated } = useVesper();

  // One frame of plain ground rather than a flash of seed data being
  // replaced by the saved book a moment later.
  if (!hydrated) return <View style={styles.root} />;

  if (isDesktop) {
    return (
      <View style={styles.root}>
        <CommandBar />
        <View style={styles.desktopBody}>{children}</View>
        <Watchlist />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {children}
      <Watchlist />
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.ground,
  },
  desktopBody: {
    flex: 1,
    padding: layout.paneInset,
  },
  desktopScreen: {
    flex: 1,
  },
  desktopContent: {
    // Grow to fill, but keep a floor so panes have room to be read
    // rather than compressing to their headers.
    flexGrow: 1,
    minHeight: 620,
    // The same rule the grid uses between panes. Top-level children of a
    // screen are laid out here rather than in a `Grid`, so without this
    // the hero block and the row beneath it butt up against each other.
    gap: layout.paneGap,
  },
  mobileScroll: {
    flex: 1,
  },
  mobileContent: {
    padding: layout.paneInset,
    // The tab bar and the watch rail are siblings of the scroller, not
    // things floating over it, so the column does not have to leave a
    // tab bar's worth of blank space under the last pane. Only the raised
    // add button overhangs, and only by a few points.
    paddingBottom: space.lg,
  },

  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    height: layout.tabBarHeight,
    backgroundColor: color.card,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    paddingHorizontal: space.xs,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    gap: space.xxs,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Platform.OS === "web" ? -26 : -22,
    marginHorizontal: space.xs,
  },
});
