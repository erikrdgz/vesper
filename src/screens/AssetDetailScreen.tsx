/**
 * One asset, up close.
 *
 * The reference screens put Buy and Sell along the bottom here. Vesper
 * holds no keys and places no orders, so a pair of buttons that look like
 * they trade would be a lie told in the most expensive place on the
 * screen. What it has instead are the two things it can actually do:
 * change what you hold, and stop holding it.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useMeasure } from "../hooks/useMeasure";
import { useNavigation } from "../hooks/useNavigation";
import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { useAssetSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import { pct, tokenAmount, usd, usdSigned, weight } from "../lib/format";
import { color, space } from "../theme";
import { isDeFi, type ChartRange, type DeFiAsset } from "../types";
import { Column, Row, Screen } from "../components/AppShell";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { AreaChart } from "../components/Chart";
import { Field } from "../components/Field";
import { ChevronLeftIcon, TrashIcon } from "../components/icons";
import { Action, Delta, Divider, Segmented, Tap, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";
import { useToast } from "../components/Toast";
import { TokenObject } from "../components/TokenObject";

const RANGES = ["1H", "1D", "1W", "1M", "1Y"] as const satisfies readonly ChartRange[];

export function AssetDetailScreen({ assetId }: { assetId: string }) {
  const { assets, prices, updateAsset, removeAsset } = useVesper();
  const { closeAsset } = useNavigation();
  const { toast } = useToast();
  const netWorth = useNetWorth();
  const { isDesktop } = useResponsive();
  const [range, setRange] = useState<ChartRange>("1D");
  const chart = useMeasure();

  const asset = assets.find((candidate) => candidate.id === assetId);
  const valued = netWorth.valued.find((entry) => entry.asset.id === assetId);

  const defi = asset && isDeFi(asset) ? (asset as DeFiAsset) : null;
  const quote = defi ? prices.quotes[defi.coingeckoId] : undefined;
  const series = useAssetSeries(defi?.coingeckoId ?? "bitcoin", range, quote?.usd ?? 0);

  const [draft, setDraft] = useState(() => (defi ? String(defi.amount) : ""));
  const [costDraft, setCostDraft] = useState(() =>
    defi?.costBasisUsd === undefined ? "" : String(defi.costBasisUsd),
  );
  const [error, setError] = useState<string | null>(null);

  const windowStats = useMemo(() => {
    if (series.points.length < 2) return null;
    const values = series.points.map((point) => point.v);
    return { open: series.points[0]!.v, high: Math.max(...values), low: Math.min(...values) };
  }, [series.points]);

  // Guard rather than assume: the asset can vanish under us if it is
  // removed from another surface while this view is open.
  if (!asset || !defi || !valued) {
    return (
      <Screen>
        <Pane title="Gone">
          <Txt variant="bodyStrong">That asset is no longer in the book</Txt>
          <Action label="Back to crypto" onPress={closeAsset} />
        </Pane>
      </Screen>
    );
  }

  function commitAmount() {
    const parsed = Number(draft.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a number of tokens, zero or more.");
      return;
    }

    const rawCost = costDraft.replace(/[$,\s]/g, "").trim();
    const cost = rawCost === "" ? undefined : Number(rawCost);
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      setError("Cost has to be a number, or empty to leave it untracked.");
      return;
    }

    setError(null);
    updateAsset(assetId, { amount: parsed, costBasisUsd: cost });
    toast("Position saved", `${tokenAmount(parsed, defi!.symbol)}`, "positive");
  }

  const tone = quote && quote.change24h < 0 ? color.negative : color.accent;

  return (
    <Screen>
      <Row flex={1}>
        <Column flex={2.2}>
          <Pane
            flex={2}
            minHeight={isDesktop ? undefined : 330}
            title={`${defi.label} · ${defi.symbol}`}
            action={
              <Tap
                onPress={closeAsset}
                accessibilityRole="button"
                accessibilityLabel="Back to crypto"
              >
                <View style={styles.back}>
                  <ChevronLeftIcon size={14} />
                  <Txt variant="micro" tone="textMuted">
                    Back
                  </Txt>
                </View>
              </Tap>
            }
          >
            <View style={styles.head}>
              <View>
                <AnimatedNumber value={quote ? usd(quote.usd) : "—"} variant="display" />
                {quote && (
                  <View style={styles.deltaRow}>
                    <Delta
                      value={quote.change24h}
                      label={`${quote.change24h >= 0 ? "▲" : "▼"} ${pct(quote.change24h).replace(/[+−]/, "")}`}
                    />
                    <Txt variant="mono" tone="textMuted">
                      24h
                    </Txt>
                  </View>
                )}
              </View>
              <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} />
            </View>

            <View style={styles.chartFill} onLayout={chart.onLayout}>
              {chart.ready && (
                <AreaChart
                  points={series.points}
                  width={chart.width}
                  height={chart.height}
                  tone={tone}
                  dimmed={series.loading && series.points.length === 0}
                  crosshair
                  range={range}
                />
              )}
            </View>

            {series.source === "fallback" && (
              <Txt variant="caption" tone="textMuted">
                Indicative shape. CoinGecko would not give us history for this range, so this is a
                stand-in that ends on the quoted price.
              </Txt>
            )}
          </Pane>

          {windowStats && (
            <Pane flex={1} title={`Over ${range}`} minHeight={isDesktop ? undefined : 120}>
              <View style={styles.statRow}>
                <Stat label="Open" value={usd(windowStats.open)} />
                <Stat label="High" value={usd(windowStats.high)} />
                <Stat label="Low" value={usd(windowStats.low)} />
                <Stat
                  label="Range"
                  value={usd(windowStats.high - windowStats.low)}
                />
              </View>
            </Pane>
          )}
        </Column>

        <Column flex={1}>
          <Pane flex={1} title="Token" minHeight={isDesktop ? undefined : 220}>
            <TokenObject symbol={defi.symbol} flipIndex={0} height={isDesktop ? 180 : 160} />
          </Pane>

          <Pane title="Your position">
            <AnimatedNumber value={usd(valued.valueUsd)} variant="h1" />
            <Txt variant="mono" tone="textMuted">
              {tokenAmount(defi.amount, defi.symbol)} · {weight(valued.weight)} of the book
            </Txt>
            <Divider />
            <View style={styles.row}>
              <Txt variant="caption" tone="textSecondary">
                Moved today
              </Txt>
              <Txt variant="mono" tone={valued.change24hUsd >= 0 ? "positive" : "negative"}>
                {usdSigned(valued.change24hUsd)}
              </Txt>
            </View>
            {valued.costUsd !== null && (
              <>
                <View style={styles.row}>
                  <Txt variant="caption" tone="textSecondary">
                    Cost
                  </Txt>
                  <Txt variant="mono" tone="textSecondary">
                    {usd(valued.costUsd)}
                  </Txt>
                </View>
                <View style={styles.row}>
                  <Txt variant="caption" tone="textSecondary">
                    Return
                  </Txt>
                  <Txt variant="mono" tone={valued.gainUsd! >= 0 ? "positive" : "negative"}>
                    {usdSigned(valued.gainUsd ?? 0)} · {pct(valued.gainPct ?? 0)}
                  </Txt>
                </View>
              </>
            )}
            <PriceSourceNote compact />
          </Pane>

          <Pane title="Adjust holding">
            <Field
              label={`${defi.symbol} held`}
              value={draft}
              onChangeText={setDraft}
              keyboardType="decimal-pad"
              placeholder="0.00"
              error={error}
            />
            <Field
              label="Total paid (optional)"
              value={costDraft}
              onChangeText={setCostDraft}
              keyboardType="decimal-pad"
              prefix="$"
              placeholder="Leave empty to stop tracking return"
            />
            <Action label="Save" variant="primary" onPress={commitAmount} />
            <Action
              label="Remove"
              variant="quiet"
              icon={<TrashIcon size={16} tone={color.negative} />}
              onPress={() => {
                removeAsset(assetId);
                toast(`${defi.label} removed`, "It is out of your book.");
                closeAsset();
              }}
            />
            <Txt variant="caption" tone="textMuted">
              Saved to this browser only. Vesper places no orders and holds no keys.
            </Txt>
          </Pane>
        </Column>
      </Row>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="micro" tone="textMuted">
        {label}
      </Txt>
      <Txt variant="mono">{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xxs,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.sm,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    marginTop: space.xxs,
  },
  chartFill: {
    flex: 1,
    minHeight: 150,
    marginHorizontal: -space.sm,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xl,
    alignItems: "center",
    flex: 1,
  },
  stat: {
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
