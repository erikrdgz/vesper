/**
 * The frame: one set of screens, two sets of chrome.
 *
 * Above 768px the four tabs become a left rail and the content sits in a
 * 65/35 grid capped at 1200px. Below it, the same tabs become a bottom bar
 * with the add button raised out of it, and the grid collapses to one
 * column. The screens themselves do not know which they are in — they ask
 * `<Columns>` for a layout and it resolves.
 */

import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useNavigation } from "../hooks/useNavigation";
import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { color, layout, radius, shadow, space } from "../theme";
import type { TabId } from "../types";
import {
  AnalyticsIcon,
  CryptoIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
  type IconProps,
} from "./icons";
import { Txt } from "./primitives";

const TABS: { id: TabId; label: string; Icon: (props: IconProps) => React.ReactElement }[] = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "analytics", label: "Analytics", Icon: AnalyticsIcon },
  { id: "crypto", label: "Crypto", Icon: CryptoIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/**
 * The two-column grid, or one column on a phone.
 *
 * Widths are resolved in points by `useResponsive` rather than left as
 * percentages, because the charts are SVG and need a number to draw into.
 */
export function Columns({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary: React.ReactNode;
}) {
  const { isDesktop, primaryWidth, secondaryWidth } = useResponsive();

  if (!isDesktop) {
    return (
      <View style={styles.singleColumn}>
        {primary}
        {secondary}
      </View>
    );
  }

  return (
    <View style={styles.columns}>
      <View style={{ width: primaryWidth, gap: space.xl }}>{primary}</View>
      <View style={{ width: secondaryWidth, gap: space.xl }}>{secondary}</View>
    </View>
  );
}

/** Every screen's outer scroll container, so padding is defined once. */
export function Screen({ children }: { children: React.ReactNode }) {
  const { isDesktop, gutter, contentWidth } = useResponsive();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingHorizontal: gutter,
          // Clear the bottom bar and the raised add button on a phone.
          paddingBottom: isDesktop ? space.huge : layout.tabBarHeight + space.huge,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: contentWidth, alignSelf: "center", gap: space.xl }}>{children}</View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

function Rail() {
  const { tab, setTab, openSheet } = useNavigation();

  return (
    <View style={styles.rail} accessibilityRole="tablist" accessibilityLabel="Sections">
      <View style={styles.wordmark}>
        <View style={styles.mark} />
        <Txt variant="h2">Vesper</Txt>
      </View>

      <View style={styles.railItems}>
        {TABS.map(({ id, label, Icon }) => {
          const active = id === tab;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.railItem, active && styles.railItemActive]}
            >
              <Icon size={20} tone={active ? color.accent : color.textSecondary} />
              <Txt variant="title" tone={active ? "text" : "textSecondary"}>
                {label}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => openSheet("add-asset")}
        accessibilityRole="button"
        accessibilityLabel="Add an asset"
        style={[styles.railAdd, shadow.glow]}
      >
        <PlusIcon size={18} tone={color.accentInk} />
        <Txt variant="title" tone="accentInk">
          Add asset
        </Txt>
      </Pressable>
    </View>
  );
}

function TabBar() {
  const { tab, setTab, openSheet } = useNavigation();

  // Two tabs, the raised button, then two more — the arrangement in the
  // reference, and the reason the add button is not a fifth tab.
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
      <View style={[styles.root, styles.desktop]}>
        <Rail />
        <View style={styles.desktopContent}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
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
  desktop: {
    flexDirection: "row",
  },
  desktopContent: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: space.xxl,
  },
  columns: {
    flexDirection: "row",
    gap: layout.columnGap,
    alignItems: "flex-start",
  },
  singleColumn: {
    gap: space.md,
  },

  rail: {
    width: layout.railWidth,
    borderRightWidth: 1,
    borderRightColor: color.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.xl,
    gap: space.xl,
  },
  wordmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: color.accent,
  },
  railItems: {
    gap: space.xxs,
    flex: 1,
  },
  railItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  railItemActive: {
    backgroundColor: color.card,
  },
  railAdd: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: color.accent,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
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
    // Lifts the button out of the bar, as in the reference.
    marginTop: Platform.OS === "web" ? -26 : -22,
    marginHorizontal: space.xs,
  },
});
