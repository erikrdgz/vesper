/**
 * The frame: one set of screens, two sets of chrome.
 *
 * Desktop is a terminal. A command bar carries the navigation, a ticker
 * runs underneath it, and the rest of the window is a grid of panes that
 * fills the viewport and does not scroll as a page — panes that need more
 * room scroll inside themselves, the way a real terminal's blotter does.
 * There is no sidebar and no max-width: the content is the instrument, not
 * an article about one.
 *
 * Mobile is a phone app. The same panes stack into one scrolling column
 * under a bottom tab bar with the add button raised out of it.
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
  SettingsIcon,
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
  { id: "settings", label: "Settings", short: "You", Icon: SettingsIcon },
];

/**
 * The bottom bar carries four of the five.
 *
 * Five labels plus the raised button do not fit across a phone, and
 * Settings is the one you reach for least and can reach from the
 * profile anyway.
 */
const MOBILE_TABS = TABS.filter((tab) => tab.id !== "settings");

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
    return <View style={styles.desktopScreen}>{children}</View>;
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
        <Watchlist />
        <View style={styles.desktopBody}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Watchlist />
      {children}
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
    paddingHorizontal: layout.paneInset,
    paddingBottom: layout.paneInset,
  },
  desktopScreen: {
    flex: 1,
  },
  mobileScroll: {
    flex: 1,
  },
  mobileContent: {
    paddingHorizontal: layout.paneInset,
    paddingBottom: layout.tabBarHeight + space.xxl,
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
