/**
 * Overview.
 *
 * The blotter. Net worth and its chart take the left two thirds, the book
 * and the token take the right third, and allocation and flow sit under
 * the chart. On desktop none of it scrolls as a page: the grid fills the
 * window and the holdings list scrolls inside its own pane.
 */

import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useMeasure } from "../hooks/useMeasure";
import { useNavigation } from "../hooks/useNavigation";
import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { useAssetSeries, usePortfolioSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import { pct, transactionDate, usd, usdParts, usdSigned, weight } from "../lib/format";
import { color, space } from "../theme";
import { isDeFi, type ChartRange, type DeFiAsset, type ValuedAsset } from "../types";
import { Column, Row, Screen } from "../components/AppShell";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { AllocationBar, AreaChart, BarRow, Sparkline } from "../components/Chart";
import { useChangeFlash } from "../hooks/useInteraction";
import { ChevronRightIcon } from "../components/icons";
import { Delta, Divider, Tap, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";
import { TokenObject, tokenColor } from "../components/TokenObject";

const RANGE: ChartRange = "1W";

export function OverviewScreen() {
  const netWorth = useNetWorth();
  const { transactions } = useVesper();
  const { isDesktop } = useResponsive();
  const series = usePortfolioSeries(RANGE);

  const holdings = useMemo(
    () => netWorth.valued.filter((entry) => isDeFi(entry.asset)),
    [netWorth.valued],
  );
  const largest = holdings[0];

  const flow = useMemo(() => summariseFlow(transactions), [transactions]);
  const balance = usdParts(netWorth.totalUsd);

  return (
    <Screen>
      <Row flex={1}>
        <Column flex={2.2}>
          <Pane
            flex={2}
            minHeight={isDesktop ? undefined : 300}
            title="Net worth"
            action={
              <View style={styles.headRight}>
                <Delta
                  value={netWorth.change24hPct}
                  label={`${netWorth.change24hPct >= 0 ? "▲" : "▼"} ${pct(netWorth.change24hPct).replace(/[+−]/, "")}`}
                />
                <Txt variant="mono" tone="textMuted">
                  {usdSigned(netWorth.change24hUsd)} · 24h
                </Txt>
              </View>
            }
          >
            <AnimatedNumber
              value={balance.major + balance.minor}
              variant="displayXl"
              minorVariant="display"
              minorTone={color.textSecondary}
              minorFrom={balance.major.length}
            />
            <ChartFill points={series.points} loading={series.loading} />
          </Pane>

          <Row flex={1}>
            <Pane flex={1} title="Allocation" minHeight={isDesktop ? undefined : 150}>
              <AllocationFill netWorth={netWorth} />
            </Pane>

            <Pane
              flex={1}
              title="Cash flow"
              minHeight={isDesktop ? undefined : 180}
              action={
                <Txt variant="mono" tone="textMuted">
                  {usd(flow.spent)} spent
                </Txt>
              }
            >
              <FlowFill flow={flow} />
            </Pane>
          </Row>
        </Column>

        <Column flex={1}>
          <Pane
            flex={1.2}
            title={`Book · ${netWorth.valued.length} positions`}
            scroll={isDesktop}
            flush
            action={<PriceSourceNote compact />}
          >
            {netWorth.valued.map((entry, index) => (
              <View key={entry.asset.id}>
                {index > 0 && <Divider />}
                <PositionRow entry={entry} />
              </View>
            ))}
          </Pane>

          <Pane flex={1} title="Signal" minHeight={isDesktop ? undefined : 260}>
            {largest && isDeFi(largest.asset) ? (
              <TokenPanel entry={largest} />
            ) : (
              <Txt variant="caption" tone="textMuted">
                No tokens held.
              </Txt>
            )}
          </Pane>
        </Column>
      </Row>

      <Pane title="Recent" flush minHeight={isDesktop ? 0 : undefined} style={isDesktop ? styles.hidden : undefined}>
        {transactions.slice(0, 5).map((transaction, index) => (
          <View key={transaction.id}>
            {index > 0 && <Divider />}
            <View style={styles.transfer}>
              <View style={styles.transferCopy}>
                <Txt variant="bodyStrong" numberOfLines={1}>
                  {transaction.payee}
                </Txt>
                <Txt variant="caption" tone="textMuted">
                  {transactionDate(transaction.date)}
                </Txt>
              </View>
              <Txt variant="mono" tone={transaction.amountUsd > 0 ? "positive" : "text"}>
                {usdSigned(transaction.amountUsd)}
              </Txt>
            </View>
          </View>
        ))}
      </Pane>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

/** The chart, sized to whatever the pane left over. */
function ChartFill({ points, loading }: { points: { t: number; v: number }[]; loading: boolean }) {
  const measured = useMeasure();

  return (
    <View style={styles.chartFill} onLayout={measured.onLayout}>
      {measured.ready && (
        <AreaChart
          points={points}
          width={measured.width}
          height={measured.height}
          dimmed={loading && points.length === 0}
          crosshair
          range={RANGE}
        />
      )}
    </View>
  );
}

function AllocationFill({ netWorth }: { netWorth: ReturnType<typeof useNetWorth> }) {
  const measured = useMeasure();
  const buckets = useMemo(() => bucketsOf(netWorth), [netWorth]);

  return (
    <View onLayout={measured.onLayout} style={styles.fill}>
      {measured.ready && <AllocationBar width={measured.width} segments={buckets} />}
      {netWorth.liabilitiesUsd > 0 && (
        <View style={styles.owedRow}>
          <Txt variant="caption" tone="textSecondary">
            Owed on credit
          </Txt>
          <Txt variant="mono" tone="negative">
            {usd(netWorth.liabilitiesUsd)}
          </Txt>
        </View>
      )}
    </View>
  );
}

function FlowFill({ flow }: { flow: ReturnType<typeof summariseFlow> }) {
  const measured = useMeasure();

  return (
    <View onLayout={measured.onLayout} style={styles.fill}>
      <View style={styles.flowStats}>
        <Stat label="In" value={usd(flow.income)} tone="positive" />
        <Stat label="Spent" value={usd(flow.spent)} tone="negative" />
        <Stat label="Moved" value={usd(flow.moved)} />
      </View>
      {measured.ready && flow.byCategory.length > 0 && (
        <BarRow values={flow.byCategory} width={measured.width} height={44} />
      )}
    </View>
  );
}

function Stat({ label, value, tone = "text" }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="micro" tone="textMuted">
        {label}
      </Txt>
      <Txt variant="mono" tone={tone}>
        {value}
      </Txt>
    </View>
  );
}

/** One row of the book. Flashes when its value moves. */
function PositionRow({ entry }: { entry: ValuedAsset }) {
  const { openAsset, setTab } = useNavigation();
  const flash = useChangeFlash(Math.round(entry.valueUsd * 100));
  const defi = isDeFi(entry.asset) ? (entry.asset as DeFiAsset) : null;

  const open = () => {
    if (!defi) return;
    setTab("crypto");
    openAsset(defi.id);
  };

  return (
    <Tap
      onPress={open}
      disabled={!defi}
      accessibilityRole={defi ? "button" : "text"}
      accessibilityLabel={`${entry.asset.label}, ${usd(entry.valueUsd)}`}
      scaleTo={0.995}
    >
      <View
        style={[
          styles.position,
          flash === "up" && styles.flashUp,
          flash === "down" && styles.flashDown,
        ]}
      >
        <View
          style={[
            styles.positionTick,
            { backgroundColor: defi ? tokenColor(defi.symbol) : color.textMuted },
          ]}
        />
        <View style={styles.positionCopy}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {entry.asset.label}
          </Txt>
          <Txt variant="micro" tone="textMuted">
            {defi ? "Marked to market" : "Stated"} · {weight(entry.weight)}
          </Txt>
        </View>
        <View style={styles.positionValue}>
          <Txt variant="mono" tone={entry.valueUsd < 0 ? "negative" : "text"}>
            {entry.priced ? usd(entry.valueUsd) : "—"}
          </Txt>
          {defi && entry.priced && (
            <Txt variant="micro" tone={entry.change24hPct >= 0 ? "positive" : "negative"}>
              {entry.change24hPct >= 0 ? "▲" : "▼"} {pct(entry.change24hPct).replace(/[+−]/, "")}
            </Txt>
          )}
        </View>
        {defi && <ChevronRightIcon size={14} tone={color.textMuted} />}
      </View>
    </Tap>
  );
}

/** The 3D token plus the readout it belongs to. */
function TokenPanel({ entry }: { entry: ValuedAsset }) {
  const asset = entry.asset as DeFiAsset;
  const { prices } = useVesper();
  const price = prices.quotes[asset.coingeckoId]?.usd ?? 0;
  const series = useAssetSeries(asset.coingeckoId, RANGE, price);

  return (
    <View style={styles.tokenPanel}>
      <TokenObject symbol={asset.symbol} flipIndex={0} height={140} />
      <View style={styles.tokenReadout}>
        <View>
          <Txt variant="h2">{asset.symbol}</Txt>
          <Txt variant="micro" tone="textMuted">
            Largest position
          </Txt>
        </View>
        <Sparkline
          points={series.points}
          tone={entry.change24hPct >= 0 ? color.positive : color.negative}
          width={72}
          height={28}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const CATEGORY_LABEL: Record<string, string> = {
  food: "Food",
  transport: "Travel",
  income: "Income",
  transfer: "Sent",
  subscription: "Bills",
  shopping: "Shops",
};

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
    // A transfer to your own exchange account is money moved, not spent.
    // Counting it as spending flattens every real category beside it.
    if (transaction.category === "transfer") {
      moved += amount;
      continue;
    }
    spent += amount;
    buckets.set(transaction.category, (buckets.get(transaction.category) ?? 0) + amount);
  }

  const byCategory = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label: CATEGORY_LABEL[label] ?? label, value }));

  return { income, spent, moved, byCategory };
}

function bucketsOf(netWorth: ReturnType<typeof useNetWorth>) {
  const sum = (predicate: (entry: ValuedAsset) => boolean) =>
    netWorth.valued.filter(predicate).reduce((total, entry) => total + entry.valueUsd, 0);

  return [
    {
      label: "Cash",
      tone: color.accent,
      weight: sum((e) => e.asset.class === "tradfi" && e.asset.kind === "cash"),
    },
    {
      label: "Markets",
      tone: "#7FB5FF",
      weight: sum(
        (e) =>
          e.asset.class === "tradfi" &&
          (e.asset.kind === "brokerage" || e.asset.kind === "retirement"),
      ),
    },
    { label: "Crypto", tone: color.positive, weight: netWorth.deFiUsd },
  ];
}

const styles = StyleSheet.create({
  headRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  chartFill: {
    flex: 1,
    minHeight: 120,
    marginHorizontal: -space.md,
    marginBottom: -space.md,
  },
  fill: {
    flex: 1,
    gap: space.sm,
    justifyContent: "center",
  },
  owedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flowStats: {
    flexDirection: "row",
    gap: space.lg,
    flexWrap: "wrap",
  },
  stat: {
    gap: 2,
  },
  position: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  positionTick: {
    width: 3,
    height: 26,
    borderRadius: 2,
  },
  positionCopy: {
    flex: 1,
    gap: 2,
  },
  positionValue: {
    alignItems: "flex-end",
    gap: 2,
  },
  flashUp: {
    backgroundColor: color.positiveSoft,
  },
  flashDown: {
    backgroundColor: color.negativeSoft,
  },
  tokenPanel: {
    flex: 1,
    justifyContent: "space-between",
    gap: space.xs,
  },
  tokenReadout: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  transfer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  transferCopy: {
    flex: 1,
    gap: 2,
  },
  hidden: {
    display: "none",
  },
});
