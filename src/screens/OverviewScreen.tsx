/**
 * Overview.
 *
 * The blotter. Net worth and its chart take the left two thirds, the book
 * and the token take the right third, and allocation and flow sit under
 * the chart. On desktop none of it scrolls as a page: the grid fills the
 * window and the holdings list scrolls inside its own pane.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useMeasure } from "../hooks/useMeasure";
import { useNavigation } from "../hooks/useNavigation";
import { useNetWorth } from "../hooks/useNetWorth";
import { headline, sinceLastVisit } from "../lib/narrate";
import { useResponsive } from "../hooks/useResponsive";
import { useAssetSeries, usePortfolioSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import {
  firstName,
  greeting,
  plural,
  pct,
  shortDate,
  today,
  transactionDate,
  usd,
  usdParts,
  usdSigned,
  weight,
} from "../lib/format";
import { color, radius, space } from "../theme";
import { isDeFi, type ChartRange, type DeFiAsset, type ValuedAsset } from "../types";
import { Column, Row, Screen } from "../components/AppShell";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { AllocationBar, AreaChart, BarRow, Sparkline } from "../components/Chart";
import { useChangeFlash } from "../hooks/useInteraction";
import {
  AnalyticsIcon,
  ChevronRightIcon,
  PlusIcon,
  SwapIcon,
  WalletIcon,
  WatchIcon,
} from "../components/icons";
import { Action, Avatar, Delta, Divider, Tap, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";
import { TokenObject, tokenColor } from "../components/TokenObject";

const RANGE: ChartRange = "1W";

type SortId = "value" | "return" | "name";

const SORTS: { id: SortId; label: string }[] = [
  { id: "value", label: "VALUE" },
  { id: "return", label: "RETURN" },
  { id: "name", label: "A–Z" },
];

export function OverviewScreen() {
  const netWorth = useNetWorth();
  const { transactions, alerts, snapshots, lastSeenAt } = useVesper();
  const { setTab, openSheet } = useNavigation();
  const { isDesktop } = useResponsive();
  const series = usePortfolioSeries(RANGE);

  const holdings = useMemo(
    () => netWorth.valued.filter((entry) => isDeFi(entry.asset)),
    [netWorth.valued],
  );
  const largest = holdings[0];

  const flow = useMemo(() => summariseFlow(transactions), [transactions]);
  const balance = usdParts(netWorth.totalUsd);
  const empty = netWorth.valued.length === 0;
  const say = useMemo(() => headline(netWorth, alerts), [netWorth, alerts]);

  /**
   * The book, ordered the way you asked.
   *
   * Value first by default, because that is what a book of accounts is
   * usually read for. Return answers a different question — what is
   * working — and name is for when you already know what you are
   * looking for and just want to find it.
   */
  const [sort, setSort] = useState<SortId>("value");
  const sorted = useMemo(() => {
    const rows = [...netWorth.valued];
    if (sort === "name") {
      return rows.sort((a, b) => a.asset.label.localeCompare(b.asset.label));
    }
    if (sort === "return") {
      // Positions with no basis have no return to rank, so they sink
      // rather than sorting as if they were flat.
      return rows.sort((a, b) => (b.gainPct ?? -Infinity) - (a.gainPct ?? -Infinity));
    }
    return rows.sort((a, b) => b.valueUsd - a.valueUsd);
  }, [netWorth.valued, sort]);
  const welcomeBack = useMemo(
    () => sinceLastVisit(snapshots, netWorth.totalUsd, lastSeenAt),
    [snapshots, netWorth.totalUsd, lastSeenAt],
  );

  if (empty) {
    return (
      <Screen>
        <Opening />

        <Pane flex={1} minHeight={isDesktop ? undefined : 360}>
          <View style={styles.emptyState}>
            <View style={styles.emptyMark}>
              <WalletIcon size={26} tone={color.accent} />
            </View>
            <Txt variant="h2" heading>
              Your book is empty
            </Txt>
            <Txt variant="body" tone="textSecondary" style={styles.emptyCopy}>
              Add a bank account, a brokerage or a token and Vesper will start valuing it. Stated
              balances are taken at face value; tokens are priced live and marked to market.
            </Txt>
            <View style={styles.emptyActions}>
              <Action
                label="Add your first asset"
                variant="primary"
                onPress={() => openSheet("add-asset")}
              />
              <Action label="Browse the watchlist" onPress={() => setTab("watch")} />
            </View>
            <Txt variant="caption" tone="textMuted" style={styles.emptyCopy}>
              Nothing you enter leaves this browser.
            </Txt>
          </View>
        </Pane>
      </Screen>
    );
  }

  return (
    <Screen>
      <Opening>
        <View style={styles.say}>
          <View
            style={[
              styles.sayTick,
              {
                backgroundColor:
                  say.tone === "up"
                    ? color.positive
                    : say.tone === "down"
                      ? color.negative
                      : color.hairlineStrong,
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            {/* Only a returning visitor gets this, and only after a
                real gap. It leads, because it is the one thing they
                could not have known already. */}
            {welcomeBack ? <Txt variant="h2">{welcomeBack}</Txt> : null}
            <Txt variant={welcomeBack ? "body" : "h2"} tone={welcomeBack ? "textSecondary" : "text"}>
              {say.lead}
            </Txt>
            {say.detail ? (
              <Txt variant="body" tone="textSecondary">
                {say.detail}
              </Txt>
            ) : null}
          </View>
        </View>
      </Opening>

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
            {/* On a desktop pane the figure and the four actions share
                one band: the number only ever fills the left third, and
                a stack of two left-aligned blocks left half the hero
                empty and took that height off the chart. On a phone they
                stay stacked — there is no width to share. */}
            <View style={isDesktop ? styles.heroBand : undefined}>
              <View>
                <AnimatedNumber
                  value={balance.major + balance.minor}
                  variant="displayXl"
                  minorVariant="display"
                  minorTone={color.textSecondary}
                  minorFrom={balance.major.length}
                />

                {/* Two labelled figures with a rule between them, rather
                    than one sentence of alternating case and colour. The
                    old run wrapped mid-phrase on a phone — "on
                    $102,020.00 invested" landed on its own line under a
                    number it was no longer next to. */}
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Txt variant="micro" tone="textMuted">
                      Total return
                    </Txt>
                    <Txt variant="mono" tone={netWorth.gainUsd >= 0 ? "positive" : "negative"}>
                      {usdSigned(netWorth.gainUsd)} · {pct(netWorth.gainPct)}
                    </Txt>
                  </View>
                  <View style={styles.statRule} />
                  <View style={styles.stat}>
                    <Txt variant="micro" tone="textMuted">
                      Invested
                    </Txt>
                    <Txt variant="mono" tone="textSecondary">
                      {usd(netWorth.costUsd)}
                    </Txt>
                  </View>
                </View>
              </View>

              {/* Something to do, beside the number. The hero used to
                  be a figure and a chart and no way to act on either. */}
              <View style={[styles.quickRow, isDesktop && styles.quickRowInline]}>
                <Quick
                  label="Add"
                  icon={<PlusIcon size={18} tone={color.accent} />}
                  onPress={() => openSheet("add-asset")}
                />
                <Quick
                  label="Swap"
                  icon={<SwapIcon size={18} tone={color.accent} />}
                  onPress={() => setTab("exchange")}
                />
                <Quick
                  label="Watch"
                  icon={<WatchIcon size={18} tone={color.accent} />}
                  onPress={() => setTab("watch")}
                />
                <Quick
                  label="Charts"
                  icon={<AnalyticsIcon size={18} tone={color.accent} />}
                  onPress={() => setTab("analytics")}
                />
              </View>
            </View>

            <ChartFill
              points={series.points}
              loading={series.loading}
              flat={netWorth.deFiUsd === 0}
            />
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
            title={`Book · ${plural(netWorth.valued.length, "position")}`}
            scroll={isDesktop}
            flush
            action={
              <View style={styles.sorts}>
                {SORTS.map((option) => (
                  <Tap
                    key={option.id}
                    onPress={() => setSort(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sort === option.id }}
                    accessibilityLabel={`Sort by ${option.label}`}
                  >
                    <View style={[styles.sort, sort === option.id && styles.sortOn]}>
                      <Txt variant="micro" tone={sort === option.id ? "accentInk" : "textMuted"}>
                        {option.label}
                      </Txt>
                    </View>
                  </Tap>
                ))}
              </View>
            }
          >
            {sorted.map((entry, index) => (
              <View key={entry.asset.id}>
                {index > 0 && <Divider />}
                <PositionRow entry={entry} />
              </View>
            ))}
          </Pane>

          <Pane
            flex={1}
            title="Signal"
            minHeight={isDesktop ? undefined : 260}
            action={<PriceSourceNote compact />}
          >
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

/**
 * The opening.
 *
 * Deliberately not a pane. The first thing on the screen should read as
 * someone speaking to you, and a greeting inside a bento block reads as a
 * caption on the block — which is what it was, two lines of grey label
 * boxed between the watch bar and the balance. It is on the ground now,
 * at the top of the column, a size up from the balance below it and in
 * plain white, with the narration tucked under it as `children`.
 */
function Opening({ children }: { children?: React.ReactNode }) {
  const { profile } = useVesper();
  const { setTab } = useNavigation();
  const { isDesktop } = useResponsive();

  return (
    <View style={styles.opening}>
      {/* Two lines, not one. "Good afternoon, Alexandra" at this size
          wraps on a phone wherever it likes; broken by hand it always
          breaks after the comma. The avatar rides the name line for the
          same reason — sharing the first line would squeeze the longest
          greeting into two of its own. */}
      <View style={styles.openingTop}>
        <Txt variant="greeting">{greeting()},</Txt>
        {/* The date, on the greeting's own baseline. A band this wide
            with everything crowded into its left third reads as an
            accident; two anchors and the width is the composition. It
            is desktop-only because a phone has no width to anchor and
            the avatar is already holding that corner. */}
        {isDesktop && (
          <Txt variant="micro" tone="textMuted">
            {today()}
          </Txt>
        )}
      </View>
      <View style={styles.openingName}>
        <Txt variant="greeting" heading>
          {firstName(profile.name)}
        </Txt>
        {/* Mobile only. The desktop command bar already carries the
            avatar, and two of them stacked up the right-hand edge is one
            portrait of you too many. */}
        {!isDesktop && (
          <Tap
            onPress={() => setTab("wallet")}
            accessibilityRole="button"
            accessibilityLabel="Open your wallet"
          >
            <Avatar name={profile.name} size={48} />
          </Tap>
        )}
      </View>
      {children}
    </View>
  );
}

/**
 * The chart, sized to whatever the pane left over.
 *
 * With no tokens held the series is a flat line at the stated balance,
 * which is arithmetically right and looks like a rendering failure. A
 * book of only stated balances gets a sentence instead.
 */
function ChartFill({
  points,
  loading,
  flat,
}: {
  points: { t: number; v: number }[];
  loading: boolean;
  flat: boolean;
}) {
  const measured = useMeasure();

  if (flat) {
    return (
      <View style={[styles.chartFill, styles.chartEmpty]}>
        <Txt variant="caption" tone="textMuted" style={styles.chartEmptyCopy}>
          Stated balances do not move on their own, so there is no line to draw yet. Add a token
          and this starts tracking live.
        </Txt>
      </View>
    );
  }

  const start = points[0];

  return (
    <>
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

      {/* Both ends of the line, named. A week of someone's net worth
          drawn with no axis at all is decoration: it could be an hour
          or a decade, and the shape means nothing until you know
          which. */}
      {start ? (
        <View style={styles.chartAxis}>
          <Txt variant="micro" tone="textMuted">
            {shortDate(start.t)}
          </Txt>
          <Txt variant="micro" tone="textMuted">
            Now
          </Txt>
        </View>
      ) : null}
    </>
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

/**
 * A circular quick action, as the references use under a balance.
 *
 * Sized on desktop, shared out on a phone. Four flexed children strung
 * across a 1300pt pane put a hundred points of nothing between each
 * icon and the next, which reads as four unrelated buttons rather than
 * one set; on a 330pt pane the same flex is exactly right.
 */
function Quick({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const { isDesktop } = useResponsive();

  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={isDesktop ? styles.quickSlot : styles.quickFill}
    >
      <View style={styles.quick}>
        <View style={styles.quickIcon}>{icon}</View>
        <Txt variant="micro" tone="textSecondary">
          {label}
        </Txt>
      </View>
    </Tap>
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
  const { openAsset, setTab, openPosition } = useNavigation();
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
      onLongPress={() => openPosition(entry.asset.id)}
      delayLongPress={380}
      accessibilityRole="button"
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
            {entry.gainPct === null
              ? `${defi ? "Marked to market" : "Stated"} · ${weight(entry.weight)}`
              : `${weight(entry.weight)} · ${usdSigned(entry.gainUsd ?? 0)} since bought`}
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
  sorts: {
    flexDirection: "row",
    gap: space.xxs,
  },
  sort: {
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: color.well,
  },
  sortOn: {
    backgroundColor: color.accent,
  },
  headRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  opening: {
    // Matches a pane's own body padding, so the greeting starts on the
    // same line as every pane title under it even though it is not in
    // one.
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  openingTop: {
    flexDirection: "row",
    // The date sits on the greeting's baseline, not its box: against
    // a 46pt line any other alignment puts it visibly adrift.
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.md,
  },
  openingName: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  say: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.lg,
  },
  sayTick: {
    width: 3,
    borderRadius: 2,
    alignSelf: "stretch",
  },
  heroBand: {
    flexDirection: "row",
    // The actions sit on the figure's floor, not its middle: aligned to
    // the bottom, the row of labels and the "invested" line read as one
    // baseline across the band.
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.xl,
  },
  quickRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.md,
  },
  quickRowInline: {
    marginTop: 0,
  },
  quickSlot: {
    width: 76,
  },
  quickFill: {
    flex: 1,
  },
  quick: {
    alignItems: "center",
    gap: space.xxs,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.cardRaised,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.xxl,
  },
  emptyMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.accentSoft,
    marginBottom: space.xs,
  },
  emptyCopy: {
    textAlign: "center",
    maxWidth: 380,
  },
  emptyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.xs,
    marginTop: space.xs,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.xs,
  },
  statRule: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: color.hairline,
  },
  chartEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  chartEmptyCopy: {
    textAlign: "center",
    maxWidth: 360,
  },
  chartFill: {
    flex: 1,
    minHeight: 120,
    marginHorizontal: -space.sm,
  },
  chartAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.xs,
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
