/**
 * Analytics.
 *
 * The one screen that shows net worth over time, and the one place the
 * chart's honesty caveat has to appear: the crypto half is real market
 * history, the stated half is held flat because nobody records a daily
 * snapshot of a checking account. Saying so is cheaper than pretending.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { usePortfolioSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import { pct, usd, usdSigned, weight } from "../lib/format";
import { space } from "../theme";
import { isDeFi, type ChartRange } from "../types";
import { Columns, Screen } from "../components/AppShell";
import { AreaChart, BarRow } from "../components/Chart";
import {
  Card,
  Delta,
  Divider,
  SectionHeader,
  Segmented,
  Txt,
} from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Reveal } from "../components/Reveal";

const RANGES = ["1D", "1W", "1M", "1Y"] as const satisfies readonly ChartRange[];

export function AnalyticsScreen() {
  const [range, setRange] = useState<ChartRange>("1M");
  const netWorth = useNetWorth();
  const { transactions } = useVesper();
  const series = usePortfolioSeries(range);
  const { isDesktop, primaryWidth, contentWidth } = useResponsive();

  const chartWidth = (isDesktop ? primaryWidth : contentWidth) - space.lg * 2;

  // Change across the visible window, which is not the same as the 24h
  // figure on Home and should not silently borrow its number.
  const windowChange = useMemo(() => {
    if (series.points.length < 2) return { usd: 0, pct: 0 };
    const first = series.points[0]!.v;
    const last = series.points[series.points.length - 1]!.v;
    return { usd: last - first, pct: first > 0 ? ((last - first) / first) * 100 : 0 };
  }, [series.points]);

  const monthlyFlow = useMemo(() => summariseFlow(transactions), [transactions]);

  const primary = (
    <>
      <Reveal index={0}>
        <Card>
          <View style={styles.chartHead}>
            <View style={styles.chartTitle}>
              <Txt variant="micro" tone="textMuted">
                Net worth
              </Txt>
              <Txt variant="display">{usd(netWorth.totalUsd)}</Txt>
              <View style={styles.deltaRow}>
                <Delta value={windowChange.pct} label={pct(windowChange.pct)} />
                <Txt variant="caption" tone="textMuted">
                  {usdSigned(windowChange.usd)} over {range}
                </Txt>
              </View>
            </View>
            <Segmented
              label="Chart range"
              options={RANGES}
              value={range}
              onChange={setRange}
            />
          </View>

          <View style={{ marginTop: space.lg }}>
            <AreaChart
              points={series.points}
              width={chartWidth}
              height={200}
              dimmed={series.loading && series.points.length === 0}
            />
          </View>

          <Txt variant="caption" tone="textMuted" style={{ marginTop: space.sm }}>
            Crypto is real market history. Stated balances are held flat, because Vesper keeps no
            record of what your bank said last Tuesday.
          </Txt>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card>
          <SectionHeader title="Money in and out" />
          <View style={styles.flowSummary}>
            <View style={styles.flowStat}>
              <Txt variant="caption" tone="textMuted">
                In
              </Txt>
              <Txt variant="h2" tone="positive">
                {usd(monthlyFlow.income)}
              </Txt>
            </View>
            <View style={styles.flowStat}>
              <Txt variant="caption" tone="textMuted">
                Spent
              </Txt>
              <Txt variant="h2" tone="negative">
                {usd(monthlyFlow.spend)}
              </Txt>
            </View>
            <View style={styles.flowStat}>
              <Txt variant="caption" tone="textMuted">
                Moved
              </Txt>
              <Txt variant="h2">{usd(monthlyFlow.moved)}</Txt>
            </View>
          </View>
          <View style={{ marginTop: space.lg }}>
            <BarRow values={monthlyFlow.byCategory} width={chartWidth} />
          </View>
          <Txt variant="caption" tone="textMuted" style={{ marginTop: space.sm }}>
            Transfers between your own accounts are counted as moved, not spent, and left out of
            the categories.
          </Txt>
        </Card>
      </Reveal>
    </>
  );

  const secondary = (
    <>
      <Reveal index={isDesktop ? 1 : 2}>
        <Card padding="none">
          <View style={styles.cardHead}>
            <SectionHeader title="Allocation" />
          </View>
          {netWorth.valued
            .filter((entry) => entry.valueUsd > 0)
            .map((entry, index) => (
              <View key={entry.asset.id}>
                {index > 0 && <Divider style={styles.inset} />}
                <View style={styles.allocRow}>
                  <View style={styles.allocCopy}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {entry.asset.label}
                    </Txt>
                    <Txt variant="caption" tone="textMuted">
                      {isDeFi(entry.asset) ? "Marked to market" : "Stated balance"}
                    </Txt>
                  </View>
                  <View style={styles.allocValue}>
                    <Txt variant="bodyStrong">{usd(entry.valueUsd)}</Txt>
                    <Txt variant="caption" tone="textMuted">
                      {weight(entry.weight)}
                    </Txt>
                  </View>
                </View>
              </View>
            ))}
        </Card>
      </Reveal>

      <Reveal index={isDesktop ? 2 : 3}>
        <Card>
          <SectionHeader title="Movers today" />
          {netWorth.valued
            .filter((entry) => isDeFi(entry.asset) && entry.priced)
            .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))
            .slice(0, 3)
            .map((entry) => (
              <View key={entry.asset.id} style={styles.moverRow}>
                <Txt variant="bodyStrong">
                  {isDeFi(entry.asset) ? entry.asset.symbol : entry.asset.label}
                </Txt>
                <Txt variant="caption" tone="textMuted" style={{ flex: 1 }}>
                  {usdSigned(entry.change24hUsd)}
                </Txt>
                <Delta value={entry.change24hPct} label={pct(entry.change24hPct)} />
              </View>
            ))}
          <Divider style={{ marginVertical: space.sm }} />
          <PriceSourceNote />
        </Card>
      </Reveal>

      {netWorth.liabilitiesUsd > 0 && (
        <Reveal index={isDesktop ? 3 : 4}>
          <Card>
            <SectionHeader title="Owed" />
            <Txt variant="display" tone="negative">
              {usd(netWorth.liabilitiesUsd)}
            </Txt>
            <Txt variant="caption" tone="textMuted" style={{ marginTop: space.xs }}>
              Subtracted from net worth, left out of the allocation percentages.
            </Txt>
          </Card>
        </Reveal>
      )}
    </>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="h1" heading>
          Analytics
        </Txt>
      </View>
      <Columns primary={primary} secondary={secondary} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

/** Four characters is not enough to tell "transport" from "transfer". */
const CATEGORY_LABEL: Record<string, string> = {
  food: "Food",
  transport: "Travel",
  income: "Income",
  transfer: "Sent",
  subscription: "Bills",
  shopping: "Shops",
};

/**
 * Split the ledger three ways.
 *
 * Money sent to your own exchange account is not spending, and counting it
 * as such does two bad things: it inflates the "out" figure, and one 500
 * transfer flattens every real category into a stub next to it. So
 * transfers get their own line and stay out of the category bars.
 */
function summariseFlow(transactions: { amountUsd: number; category: string }[]) {
  let income = 0;
  let spend = 0;
  let moved = 0;
  const buckets = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.amountUsd > 0) {
      income += transaction.amountUsd;
      continue;
    }

    const amount = Math.abs(transaction.amountUsd);
    if (transaction.category === "transfer") {
      moved += amount;
      continue;
    }

    spend += amount;
    buckets.set(transaction.category, (buckets.get(transaction.category) ?? 0) + amount);
  }

  const byCategory = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label: CATEGORY_LABEL[label] ?? label, value }));

  return { income, spend, moved, byCategory };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.md,
  },
  chartTitle: {
    gap: space.xxs,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  flowSummary: {
    flexDirection: "row",
    gap: space.xl,
    flexWrap: "wrap",
  },
  flowStat: {
    gap: 2,
  },
  cardHead: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  inset: {
    marginHorizontal: space.lg,
  },
  allocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  allocCopy: {
    flex: 1,
    gap: 2,
  },
  allocValue: {
    alignItems: "flex-end",
    gap: 2,
  },
  moverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xs,
  },
});
