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
  type IconProps,
} from "./icons";
import { CommandBar, Grid, Watchlist } from "./terminal";
import { Txt } from "./primitives";

const TABS: { id: TabId; label: string; Icon: (props: IconProps) => React.ReactElement }[] = [
  { id: "home", label: "Overview", Icon: HomeIcon },
  { id: "analytics", label: "Analytics", Icon: AnalyticsIcon },
  { id: "crypto", label: "Crypto", Icon: CryptoIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

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
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <View style={styles.tabBar} accessibilityRole="tablist" accessibilityLabel="Sections">
      {left.map(({ id, label, Icon }) => (
        <TabButton key={id} id={id} label={label} Icon={Icon} active={id === tab} onPress={setTab} />
      ))}

      <Pressable
        onPress={() => openSheet("add-asset")}
        accessibilityRole="button"
        accessibilityLabel="Add an asset"
        style={[styles.fab, shadow.glow]}
      >
        <PlusIcon size={24} tone={color.accentInk} strokeWidth={2.25} />
      </Pressable>

      {right.map(({ id, label, Icon }) => (
        <TabButton key={id} id={id} label={label} Icon={Icon} active={id === tab} onPress={setTab} />
      ))}
    </View>
  );
}

function TabButton({
  id,
  label,
  Icon,
  active,
  onPress,
}: {
  id: TabId;
  label: string;
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
      <Txt variant="micro" tone={active ? "accent" : "textMuted"}>
        {label}
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
  },
  desktopScreen: {
    flex: 1,
  },
  mobileScroll: {
    flex: 1,
  },
  mobileContent: {
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
