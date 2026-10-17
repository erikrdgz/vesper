/**
 * Analytics.
 *
 * The one screen that plots net worth over time, and the one that has to
 * carry the caveat: the crypto half is real market history, the stated
 * half is held flat, because nobody records a daily snapshot of a checking
 * account. The note sits under the chart rather than in a tooltip.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useMeasure } from "../hooks/useMeasure";
import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { usePortfolioSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import { pct, usd, usdSigned, weight } from "../lib/format";
import { color, space } from "../theme";
import { isDeFi, type ChartRange } from "../types";
import { Column, Row, Screen } from "../components/AppShell";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { AreaChart, BarRow } from "../components/Chart";
import { Delta, Divider, Segmented, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";
import { tokenColor } from "../components/TokenObject";

const RANGES = ["1D", "1W", "1M", "1Y"] as const satisfies readonly ChartRange[];

const CATEGORY_LABEL: Record<string, string> = {
  food: "Food",
  transport: "Travel",
  income: "Income",
  transfer: "Sent",
  subscription: "Bills",
  shopping: "Shops",
};

export function AnalyticsScreen() {
  const [range, setRange] = useState<ChartRange>("1M");
  const netWorth = useNetWorth();
  const { transactions } = useVesper();
  const series = usePortfolioSeries(range);
  const { isDesktop } = useResponsive();
  const chart = useMeasure();
  const bars = useMeasure();

  // Change across the visible window, which is not the 24h figure on
  // Overview and must not silently borrow its number.
  const windowChange = useMemo(() => {
    if (series.points.length < 2) return { usd: 0, pct: 0 };
    const first = series.points[0]!.v;
    const last = series.points[series.points.length - 1]!.v;
    return { usd: last - first, pct: first > 0 ? ((last - first) / first) * 100 : 0 };
  }, [series.points]);

  const flow = useMemo(() => summariseFlow(transactions), [transactions]);
  const movers = useMemo(
    () =>
      netWorth.valued
        .filter((entry) => isDeFi(entry.asset) && entry.priced)
        .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))
        .slice(0, 4),
    [netWorth.valued],
  );

  return (
    <Screen>
      <Row flex={1}>
        <Column flex={2.2}>
          <Pane
            flex={2}
            minHeight={isDesktop ? undefined : 320}
            title="Net worth"
            action={
              <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} />
            }
          >
            <View style={styles.head}>
              <AnimatedNumber value={usd(netWorth.totalUsd)} variant="display" />
              <View style={styles.headRight}>
                <Delta
                  value={windowChange.pct}
                  label={`${windowChange.pct >= 0 ? "▲" : "▼"} ${pct(windowChange.pct).replace(/[+−]/, "")}`}
                />
                <Txt variant="mono" tone="textMuted">
                  {usdSigned(windowChange.usd)} over {range}
                </Txt>
              </View>
            </View>

            <View style={styles.chartFill} onLayout={chart.onLayout}>
              {chart.ready && (
                <AreaChart
                  points={series.points}
                  width={chart.width}
                  height={chart.height}
                  dimmed={series.loading && series.points.length === 0}
                  crosshair
                  range={range}
                />
              )}
            </View>

            <Txt variant="caption" tone="textMuted">
              Crypto is real market history. Stated balances are held flat, because Vesper keeps no
              record of what your bank said last Tuesday.
            </Txt>
          </Pane>

          <Pane
            flex={1}
            minHeight={isDesktop ? undefined : 200}
            title="Money in and out"
            action={
              <Txt variant="mono" tone="textMuted">
                {usd(flow.income)} in · {usd(flow.spent)} spent · {usd(flow.moved)} moved
              </Txt>
            }
          >
            <View style={styles.barsFill} onLayout={bars.onLayout}>
              {bars.ready && flow.byCategory.length > 0 && (
                <BarRow
                  values={flow.byCategory}
                  width={bars.width}
                  height={Math.max(32, bars.height - 26)}
                />
              )}
            </View>
            <Txt variant="caption" tone="textMuted">
              Transfers between your own accounts count as moved, not spent, and stay out of the
              categories.
            </Txt>
          </Pane>
        </Column>

        <Column flex={1}>
          <Pane
            flex={1.4}
            title="Allocation"
            scroll={isDesktop}
            flush
            action={
              <Txt variant="mono" tone="textMuted">
                {usd(netWorth.tradFiUsd + netWorth.deFiUsd)}
              </Txt>
            }
          >
            {netWorth.valued
              .filter((entry) => entry.valueUsd > 0)
              .map((entry, index) => (
                <View key={entry.asset.id}>
                  {index > 0 && <Divider />}
                  <View style={styles.allocRow}>
                    <View
                      style={[
                        styles.tick,
                        {
                          backgroundColor: isDeFi(entry.asset)
                            ? tokenColor(entry.asset.symbol)
                            : color.textMuted,
                        },
                      ]}
                    />
                    <View style={styles.allocCopy}>
                      <Txt variant="bodyStrong" numberOfLines={1}>
                        {entry.asset.label}
                      </Txt>
                      <Txt variant="micro" tone="textMuted">
                        {isDeFi(entry.asset) ? "Marked to market" : "Stated balance"}
                      </Txt>
                    </View>
                    <View style={styles.allocValue}>
                      <Txt variant="mono">{usd(entry.valueUsd)}</Txt>
                      <Txt variant="micro" tone="textMuted">
                        {weight(entry.weight)}
                      </Txt>
                    </View>
                  </View>
                </View>
              ))}
          </Pane>

          <Pane flex={1} title="Movers · 24h">
            {movers.map((entry) => (
              <View key={entry.asset.id} style={styles.moverRow}>
                <Txt variant="bodyStrong">
                  {isDeFi(entry.asset) ? entry.asset.symbol : entry.asset.label}
                </Txt>
                <Txt variant="mono" tone="textMuted" style={styles.moverAmount}>
                  {usdSigned(entry.change24hUsd)}
                </Txt>
                <Delta
                  value={entry.change24hPct}
                  label={`${entry.change24hPct >= 0 ? "▲" : "▼"} ${pct(entry.change24hPct).replace(/[+−]/, "")}`}
                />
              </View>
            ))}
            <Divider />
            <PriceSourceNote />
          </Pane>

          {netWorth.liabilitiesUsd > 0 && (
            <Pane title="Owed">
              <Txt variant="h1" tone="negative">
                {usd(netWorth.liabilitiesUsd)}
              </Txt>
              <Txt variant="caption" tone="textMuted">
                Subtracted from net worth, left out of the allocation percentages.
              </Txt>
            </Pane>
          )}
        </Column>
      </Row>
    </Screen>
  );
}

function summariseFlow(transactions: { amountUsd: number; category: string }[]) {
  let income = 0;
  let spent = 0;
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
    spent += amount;
    buckets.set(transaction.category, (buckets.get(transaction.category) ?? 0) + amount);
  }

  const byCategory = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label: CATEGORY_LABEL[label] ?? label, value }));

  return { income, spent, moved, byCategory };
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.sm,
  },
  headRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  chartFill: {
    flex: 1,
    minHeight: 140,
    marginHorizontal: -space.sm,
  },
  barsFill: {
    flex: 1,
    minHeight: 80,
    justifyContent: "flex-end",
  },
  tick: {
    width: 3,
    height: 26,
    borderRadius: 2,
  },
  allocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
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
  },
  moverAmount: {
    flex: 1,
  },
});
