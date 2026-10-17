/**
 * Settings.
 *
 * Mostly the disclosures. A dashboard that shows someone a six-figure net
 * worth owes them a plain account of where the data lives and what it is
 * worth, and burying that in a footer link would be the cowardly version.
 */

import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { relativeTime, usd } from "../lib/format";
import { color, radius, space } from "../theme";
import { isDeFi } from "../types";
import { Column, Row, Screen } from "../components/AppShell";
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

          <Pane flex={1} title="Stored data">
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
});
