/**
 * Home.
 *
 * One hero, then evidence. The gradient balance card is the only saturated
 * surface in the product and the only thing that glows, which is what makes
 * the eye land on the total before anything else. Everything below it is
 * dark cards and hairlines.
 */

import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useNavigation } from "../hooks/useNavigation";
import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { usePortfolioSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import { pct, relativeTime, transactionDate, usd, usdParts, usdSigned } from "../lib/format";
import { color, gradient, radius, shadow, space } from "../theme";
import { isDeFi, type ChartRange } from "../types";
import { Columns, Screen } from "../components/AppShell";
import { AllocationBar, AreaChart } from "../components/Chart";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  RefreshIcon,
  SwapIcon,
} from "../components/icons";
import { Avatar, Card, Delta, Divider, SectionHeader, Tap, Txt } from "../components/primitives";
import { Reveal } from "../components/Reveal";
import { PriceSourceNote } from "../components/PriceSourceNote";


export function HomeScreen() {
  const netWorth = useNetWorth();
  const { prices, transactions, refreshPrices } = useVesper();
  const { openSheet, setTab } = useNavigation();
  const { isDesktop, primaryWidth, contentWidth } = useResponsive();
  const [range] = useState<ChartRange>("1W");
  const series = usePortfolioSeries(range);

  const chartWidth = (isDesktop ? primaryWidth : contentWidth) - space.lg * 2;
  const balance = usdParts(netWorth.totalUsd);

  const primary = (
    <>
      <Reveal index={0}>
        <LinearGradient
          colors={[...gradient.hero]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, shadow.glow]}
        >
          <View style={styles.heroHead}>
            <Txt variant="micro" style={styles.onLimeMuted}>
              Total net worth
            </Txt>
            <Delta
              surface="lime"
              value={netWorth.change24hPct}
              label={`${netWorth.change24hPct >= 0 ? "↑" : "↓"} ${pct(netWorth.change24hPct)} · 24h`}
            />
          </View>

          <View style={styles.balanceRow}>
            <Txt variant="displayXl" style={styles.onLime}>
              {balance.major}
            </Txt>
            <Txt variant="display" style={styles.onLimeMuted}>
              {balance.minor}
            </Txt>
          </View>

          <Txt variant="caption" style={styles.onLimeMuted}>
            {usdSigned(netWorth.change24hUsd)} today, from crypto
          </Txt>

          <View style={styles.heroChart}>
            <AreaChart
              points={series.points}
              width={chartWidth}
              height={88}
              tone={color.accentInk}
              gridLines={0}
              dimmed={series.loading && series.points.length === 0}
            />
          </View>

          <View style={styles.quickActions}>
            <QuickActionOnLime
              label="Withdraw"
              icon={<ArrowUpIcon size={18} tone={color.accentInk} />}
              onPress={() => openSheet("send")}
            />
            <QuickActionOnLime
              label="Top up"
              icon={<ArrowDownIcon size={18} tone={color.accentInk} />}
              onPress={() => openSheet("add-asset")}
            />
            <QuickActionOnLime
              label="Exchange"
              icon={<SwapIcon size={18} tone={color.accentInk} />}
              onPress={() => setTab("crypto")}
            />
          </View>
        </LinearGradient>
      </Reveal>

      <Reveal index={1}>
        <Card>
          <SectionHeader
            title="What it is made of"
            action={
              <Txt variant="caption" tone="textMuted">
                {usd(netWorth.tradFiUsd + netWorth.deFiUsd)} gross
              </Txt>
            }
          />
          <AllocationBar
            width={chartWidth - space.lg * 2}
            segments={[
              { label: "Cash", weight: cashOf(netWorth), tone: color.accent },
              { label: "Markets", weight: marketsOf(netWorth), tone: "#7FB5FF" },
              { label: "Crypto", weight: netWorth.deFiUsd, tone: color.positive },
            ]}
          />
          {netWorth.liabilitiesUsd > 0 && (
            <>
              <Divider style={{ marginVertical: space.md }} />
              <View style={styles.row}>
                <Txt variant="caption" tone="textSecondary">
                  Owed on credit
                </Txt>
                <Txt variant="bodyStrong" tone="negative">
                  {usd(netWorth.liabilitiesUsd)}
                </Txt>
              </View>
            </>
          )}
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card padding="none">
          <View style={styles.cardHead}>
            <SectionHeader title="Recent transfers" />
          </View>
          {transactions.slice(0, 6).map((transaction, index) => (
            <View key={transaction.id}>
              {index > 0 && <Divider style={styles.inset} />}
              <View style={styles.transfer}>
                <Avatar name={transaction.payee} />
                <View style={styles.transferCopy}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {transaction.payee}
                  </Txt>
                  <Txt variant="caption" tone="textMuted">
                    {transactionDate(transaction.date)}
                  </Txt>
                </View>
                <Txt
                  variant="bodyStrong"
                  tone={transaction.amountUsd > 0 ? "positive" : "text"}
                >
                  {usdSigned(transaction.amountUsd)}
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      </Reveal>
    </>
  );

  const secondary = (
    <>
      <Reveal index={isDesktop ? 1 : 3}>
        <Card>
          <View style={styles.profile}>
            <Avatar name="Leonard Lopez" size={48} />
            <View style={{ flex: 1 }}>
              <Txt variant="title">Leonard Lopez</Txt>
              <Txt variant="caption" tone="textMuted">
                @leonardlopez
              </Txt>
            </View>
          </View>
          <Divider style={{ marginVertical: space.md }} />
          <View style={styles.statGrid}>
            <Stat label="Stated balances" value={usd(netWorth.tradFiUsd)} />
            <Stat label="Marked to market" value={usd(netWorth.deFiUsd)} />
          </View>
        </Card>
      </Reveal>

      <Reveal index={isDesktop ? 2 : 4}>
        <Card>
          <SectionHeader
            title="Prices"
            action={
              <Tap
                onPress={() => refreshPrices({ force: true })}
                accessibilityRole="button"
                accessibilityLabel="Refresh prices"
              >
                <RefreshIcon size={16} tone={prices.loading ? color.accent : color.textMuted} />
              </Tap>
            }
          />
          <PriceSourceNote />
          <Txt variant="caption" tone="textMuted" style={{ marginTop: space.xs }}>
            Checked {relativeTime(prices.fetchedAt)}. Refreshes on its own every two minutes.
          </Txt>
        </Card>
      </Reveal>

      <Reveal index={isDesktop ? 3 : 5}>
        <Card padding="none">
          <View style={styles.cardHead}>
            <SectionHeader
              title="Holdings"
              action={
                <Tap onPress={() => setTab("crypto")} accessibilityRole="button">
                  <ArrowUpRightIcon size={16} tone={color.accent} />
                </Tap>
              }
            />
          </View>
          {netWorth.valued
            .filter((entry) => isDeFi(entry.asset))
            .slice(0, 4)
            .map((entry, index) => (
              <View key={entry.asset.id}>
                {index > 0 && <Divider style={styles.inset} />}
                <View style={styles.holdingRow}>
                  <Txt variant="bodyStrong">{isDeFi(entry.asset) ? entry.asset.symbol : ""}</Txt>
                  <View style={{ flex: 1 }} />
                  <Txt variant="caption" tone="textSecondary">
                    {entry.priced ? usd(entry.valueUsd) : "No price"}
                  </Txt>
                  {entry.priced && (
                    <Delta value={entry.change24hPct} label={pct(entry.change24hPct)} size="micro" />
                  )}
                </View>
              </View>
            ))}
        </Card>
      </Reveal>
    </>
  );

  return (
    <Screen>
      <Header />
      <Columns primary={primary} secondary={secondary} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Header() {
  return (
    <View style={styles.header}>
      <View>
        <Txt variant="caption" tone="textMuted">
          Good evening
        </Txt>
        <Txt variant="h1" heading>
          Leonard
        </Txt>
      </View>
      <Avatar name="Leonard Lopez" size={44} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="caption" tone="textMuted">
        {label}
      </Txt>
      <Txt variant="title">{value}</Txt>
    </View>
  );
}

/** The quick actions sit on the lime card, so they need the ink treatment. */
function QuickActionOnLime({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={styles.quickOnLime}>
        <View style={styles.quickOnLimeIcon}>{icon}</View>
        <Txt variant="caption" style={styles.onLimeMuted}>
          {label}
        </Txt>
      </View>
    </Tap>
  );
}

const cashOf = (netWorth: ReturnType<typeof useNetWorth>) =>
  netWorth.valued
    .filter((entry) => entry.asset.class === "tradfi" && entry.asset.kind === "cash")
    .reduce((sum, entry) => sum + entry.valueUsd, 0);

const marketsOf = (netWorth: ReturnType<typeof useNetWorth>) =>
  netWorth.valued
    .filter(
      (entry) =>
        entry.asset.class === "tradfi" &&
        (entry.asset.kind === "brokerage" || entry.asset.kind === "retirement"),
    )
    .reduce((sum, entry) => sum + entry.valueUsd, 0);

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hero: {
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
  },
  heroHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  heroChart: {
    marginTop: space.xs,
  },
  // Ink on lime. Not white: white on this green fails contrast badly.
  onLime: {
    color: color.accentInk,
  },
  onLimeMuted: {
    color: "rgba(11, 14, 20, 0.62)",
  },
  quickActions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xs,
  },
  quickOnLime: {
    alignItems: "center",
    gap: space.xs,
  },
  quickOnLimeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 14, 20, 0.12)",
  },
  cardHead: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inset: {
    marginHorizontal: space.lg,
  },
  transfer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  transferCopy: {
    flex: 1,
    gap: 2,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  statGrid: {
    gap: space.sm,
  },
  stat: {
    gap: 2,
  },
  holdingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
});
