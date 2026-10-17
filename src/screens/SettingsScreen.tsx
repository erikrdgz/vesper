/**
 * Settings.
 *
 * Mostly the disclosures. A dashboard that shows someone a six-figure net
 * worth owes them a plain account of where the data lives and what it is
 * worth, and burying that in a footer link would be the cowardly version.
 */

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { relativeTime, transactionDate, usd } from "../lib/format";
import { color, radius, space } from "../theme";
import { isDeFi } from "../types";
import { TOKEN_CATALOG } from "../data/catalog";
import { Column, Row, Screen } from "../components/AppShell";
import { CoinMark } from "../components/coins";
import { ToggleRow } from "../components/Field";
import { RefreshIcon, TrashIcon } from "../components/icons";
import { Action, Divider, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";

export function SettingsScreen() {
  const {
    assets,
    prices,
    refreshPrices,
    reduceMotion,
    reduceMotionOverride,
    systemReduceMotion,
    setReduceMotion,
    resetToSeed,
    watchlist,
    toggleWatch,
    activity,
  } = useVesper();
  const netWorth = useNetWorth();
  const { isDesktop } = useResponsive();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const tokens = assets.filter(isDeFi).length;

  return (
    <Screen>
      <Row flex={1}>
        <Column flex={2.2}>
          <Pane title="Account" minHeight={isDesktop ? undefined : 150}>
            <View style={styles.tiles}>
              <Tile label="Plan" value="Standard" accent />
              <Tile label="Accounts" value={String(assets.length - tokens)} />
              <Tile label="Tokens" value={String(tokens)} />
              <Tile label="Net worth" value={usd(netWorth.totalUsd)} />
            </View>
          </Pane>

          <Pane flex={1} title="What this is" minHeight={isDesktop ? undefined : 220}>
            <Txt variant="body" tone="textSecondary">
              Vesper connects to no bank and holds no keys. The accounts are seeded mock data you
              can edit, kept in this browser and sent nowhere.
            </Txt>
            <Txt variant="body" tone="textSecondary">
              The one network call it makes is to CoinGecko's public price endpoint. Crypto values
              are real. Everything else is a number you typed.
            </Txt>
            <Divider />
            <Txt variant="caption" tone="textMuted">
              Built with React Native primitives and compiled to the web by Expo. The same
              components would run on a phone.
            </Txt>
          </Pane>

          <Pane title="Watchlist">
            <Txt variant="caption" tone="textSecondary">
              What appears in the bar across the top. Following a token costs nothing extra —
              every price on screen comes from one request.
            </Txt>
            <View style={styles.chips}>
              {TOKEN_CATALOG.map((entry) => {
                const on = watchlist.includes(entry.coingeckoId);
                return (
                  <Pressable
                    key={entry.coingeckoId}
                    onPress={() => toggleWatch(entry.coingeckoId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Follow ${entry.label}`}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <CoinMark symbol={entry.symbol} size={16} />
                    <Txt variant="micro" tone={on ? "accentInk" : "textSecondary"}>
                      {entry.symbol}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </Pane>

          <Pane title="Motion">
            <ToggleRow
              label="Reduce motion"
              description={
                reduceMotionOverride === null
                  ? `Following your system setting, which is currently ${systemReduceMotion ? "on" : "off"}.`
                  : "Set here, overriding your system setting."
              }
              value={reduceMotion}
              onChange={(value) =>
                // Returning to the system setting needs a third state, so
                // switching it back off while the OS also wants it off is
                // read as "stop overriding" rather than "force off".
                setReduceMotion(value === systemReduceMotion ? null : value)
              }
            />
          </Pane>
        </Column>

        <Column flex={1}>
          <Pane title="Price feed">
            <PriceSourceNote />
            <Txt variant="caption" tone="textMuted">
              Last checked {relativeTime(prices.fetchedAt)}.
            </Txt>
            <Action
              label="Refresh now"
              onPress={() => refreshPrices({ force: true })}
              icon={<RefreshIcon size={16} />}
            />
          </Pane>

          <Pane
            flex={1}
            title={`Activity · ${activity.length}`}
            scroll={isDesktop}
            minHeight={isDesktop ? undefined : 180}
          >
            {activity.length === 0 ? (
              <Txt variant="caption" tone="textMuted">
                Nothing yet. Swaps, additions and triggered alerts land here, so a book that
                changed under you can say what happened.
              </Txt>
            ) : (
              activity.map((entry) => (
                <View key={entry.id} style={styles.activityRow}>
                  <View style={styles.activityDot} />
                  <Txt variant="caption" tone="textSecondary" style={{ flex: 1 }}>
                    {entry.summary}
                  </Txt>
                  <Txt variant="micro" tone="textMuted">
                    {transactionDate(entry.at)}
                  </Txt>
                </View>
              ))
            )}
          </Pane>

          <Pane title="Stored data">
            <Txt variant="caption" tone="textSecondary">
              Your accounts, holdings and preferences live under one key in this browser's local
              storage. Price history is cached separately for an hour, so a reload costs CoinGecko
              nothing.
            </Txt>

            {confirmingReset ? (
              <>
                <Txt variant="caption" tone="negative">
                  This discards every edit you have made. There is no undo.
                </Txt>
                <Action
                  label="Yes, reset everything"
                  variant="primary"
                  onPress={() => {
                    void resetToSeed();
                    setConfirmingReset(false);
                  }}
                />
                <Action label="Keep my data" onPress={() => setConfirmingReset(false)} />
              </>
            ) : (
              <Action
                label="Reset to seeded data"
                variant="quiet"
                icon={<TrashIcon size={16} tone={color.negative} />}
                onPress={() => setConfirmingReset(true)}
              />
            )}
          </Pane>
        </Column>
      </Row>
    </Screen>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.tile, accent && styles.tileAccent]}>
      <Txt variant="micro" tone={accent ? "accentInk" : "textMuted"}>
        {label}
      </Txt>
      <Txt variant="h2" tone={accent ? "accentInk" : "text"}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  tile: {
    flexGrow: 1,
    minWidth: 120,
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.xs,
    backgroundColor: color.card,
  },
  tileAccent: {
    backgroundColor: color.accent,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xxs,
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    backgroundColor: color.well,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  chipOn: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xxs,
  },
  activityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.textMuted,
  },
});
