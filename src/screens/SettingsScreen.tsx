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
import { Columns, Screen } from "../components/AppShell";
import { ToggleRow } from "../components/Field";
import { RefreshIcon, TrashIcon, WalletIcon } from "../components/icons";
import {
  Action,
  Avatar,
  Card,
  Divider,
  SectionHeader,
  Txt,
} from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Reveal } from "../components/Reveal";

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

  const primary = (
    <>
      <Reveal index={0}>
        <Card>
          <View style={styles.profile}>
            <Avatar name="Leonard Lopez" size={56} />
            <View style={{ flex: 1 }}>
              <Txt variant="h2">Leonard Lopez</Txt>
              <Txt variant="caption" tone="textMuted">
                @leonardlopez
              </Txt>
            </View>
          </View>

          <View style={styles.tiles}>
            <View style={[styles.tile, styles.tileAccent]}>
              <WalletIcon size={18} tone={color.accentInk} />
              <Txt variant="bodyStrong" tone="accentInk">
                Standard
              </Txt>
              <Txt variant="caption" style={styles.onLimeMuted}>
                Your plan
              </Txt>
            </View>
            <View style={styles.tile}>
              <Txt variant="bodyStrong">{assets.length}</Txt>
              <Txt variant="caption" tone="textMuted">
                Accounts tracked
              </Txt>
            </View>
          </View>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card>
          <SectionHeader title="Motion" />
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
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card>
          <SectionHeader title="What this is" />
          <Txt variant="body" tone="textSecondary">
            Vesper connects to no bank and holds no keys. The accounts are seeded mock data you can
            edit, kept in this browser and sent nowhere.
          </Txt>
          <Txt variant="body" tone="textSecondary" style={{ marginTop: space.sm }}>
            The one network call it makes is to CoinGecko's public price endpoint. Crypto values are
            real. Everything else is a number you typed.
          </Txt>
          <Divider style={{ marginVertical: space.md }} />
          <View style={styles.row}>
            <Txt variant="caption" tone="textSecondary">
              Net worth on this device
            </Txt>
            <Txt variant="bodyStrong">{usd(netWorth.totalUsd)}</Txt>
          </View>
        </Card>
      </Reveal>
    </>
  );

  const secondary = (
    <>
      <Reveal index={isDesktop ? 1 : 3}>
        <Card>
          <SectionHeader title="Price feed" />
          <PriceSourceNote />
          <Txt variant="caption" tone="textMuted" style={{ marginVertical: space.sm }}>
            Last checked {relativeTime(prices.fetchedAt)}.
          </Txt>
          <Action
            label="Refresh now"
            onPress={() => refreshPrices({ force: true })}
            icon={<RefreshIcon size={16} />}
          />
        </Card>
      </Reveal>

      <Reveal index={isDesktop ? 2 : 4}>
        <Card>
          <SectionHeader title="Stored data" />
          <Txt variant="caption" tone="textSecondary">
            Your accounts, holdings and preferences live under one key in this browser's local
            storage. Clearing it puts the seeded book back.
          </Txt>
          <View style={{ marginTop: space.md, gap: space.xs }}>
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
          </View>
        </Card>
      </Reveal>
    </>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="h1" heading>
          Settings
        </Txt>
      </View>
      <Columns primary={primary} secondary={secondary} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  tiles: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.lg,
  },
  tile: {
    flex: 1,
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.cardRaised,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  tileAccent: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  onLimeMuted: {
    color: "rgba(11, 14, 20, 0.62)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
