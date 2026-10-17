/**
 * One asset, up close.
 *
 * The reference screens put Buy and Sell along the bottom here. Vesper
 * holds no keys and places no orders, so a pair of buttons that look like
 * they trade would be a lie told in the most expensive place on the screen.
 * What it has instead are the two things it can actually do: change what
 * you hold, and stop holding it.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useNavigation } from "../hooks/useNavigation";
import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { useAssetSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import { pct, tokenAmount, usd, usdSigned, weight } from "../lib/format";
import { color, radius, space } from "../theme";
import { isDeFi, type ChartRange, type DeFiAsset } from "../types";
import { Columns, Screen } from "../components/AppShell";
import { AreaChart } from "../components/Chart";
import { Field } from "../components/Field";
import { ChevronLeftIcon, TrashIcon } from "../components/icons";
import {
  Action,
  Card,
  Delta,
  Divider,
  SectionHeader,
  Segmented,
  Tap,
  Txt,
} from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Reveal } from "../components/Reveal";

const RANGES = ["1H", "1D", "1W", "1M", "1Y"] as const satisfies readonly ChartRange[];

export function AssetDetailScreen({ assetId }: { assetId: string }) {
  const { assets, prices, updateAsset, removeAsset } = useVesper();
  const { closeAsset } = useNavigation();
  const netWorth = useNetWorth();
  const { isDesktop, primaryWidth, contentWidth } = useResponsive();
  const [range, setRange] = useState<ChartRange>("1D");

  const asset = assets.find((candidate) => candidate.id === assetId);
  const valued = netWorth.valued.find((entry) => entry.asset.id === assetId);

  const defi = asset && isDeFi(asset) ? (asset as DeFiAsset) : null;
  const quote = defi ? prices.quotes[defi.coingeckoId] : undefined;
  const series = useAssetSeries(defi?.coingeckoId ?? "bitcoin", range, quote?.usd ?? 0);

  const [draft, setDraft] = useState(() => (defi ? String(defi.amount) : ""));
  const [error, setError] = useState<string | null>(null);

  const windowStats = useMemo(() => {
    if (series.points.length < 2) return null;
    const values = series.points.map((point) => point.v);
    return {
      open: series.points[0]!.v,
      high: Math.max(...values),
      low: Math.min(...values),
    };
  }, [series.points]);

  // Guard rather than assume: the asset can vanish under us if it is
  // removed from another surface while this view is open.
  if (!asset || !defi || !valued) {
    return (
      <Screen>
        <Tap onPress={closeAsset} accessibilityRole="button" accessibilityLabel="Go back">
          <View style={styles.back}>
            <ChevronLeftIcon size={18} />
            <Txt variant="title" tone="textSecondary">
              Back
            </Txt>
          </View>
        </Tap>
        <Card>
          <Txt variant="bodyStrong">That asset is gone</Txt>
          <Txt variant="caption" tone="textMuted">
            It was removed while this view was open.
          </Txt>
        </Card>
      </Screen>
    );
  }

  const chartWidth = (isDesktop ? primaryWidth : contentWidth) - space.lg * 2;

  function commitAmount() {
    const parsed = Number(draft.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a number of tokens, zero or more.");
      return;
    }
    setError(null);
    updateAsset(assetId, { amount: parsed });
  }

  const primary = (
    <>
      <Reveal index={0}>
        <Card>
          <View style={styles.priceHead}>
            <View>
              <Txt variant="micro" tone="textMuted">
                {defi.symbol} price
              </Txt>
              <Txt variant="display" style={{ marginTop: space.xxs }}>
                {quote ? usd(quote.usd) : "No price"}
              </Txt>
              {quote && (
                <View style={styles.deltaRow}>
                  <Delta value={quote.change24h} label={pct(quote.change24h)} />
                  <Txt variant="caption" tone="textMuted">
                    in 24h
                  </Txt>
                </View>
              )}
            </View>
            <PriceSourceNote compact />
          </View>

          <View style={{ marginTop: space.lg }}>
            <AreaChart
              points={series.points}
              width={chartWidth}
              height={220}
              tone={quote && quote.change24h < 0 ? color.negative : color.accent}
              dimmed={series.loading && series.points.length === 0}
            />
          </View>

          <View style={{ marginTop: space.md }}>
            <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} />
          </View>

          {series.source === "fallback" && (
            <Txt variant="caption" tone="textMuted" style={{ marginTop: space.sm }}>
              Indicative shape. CoinGecko would not give us history for this range, so this is a
              stand-in that ends on the quoted price.
            </Txt>
          )}
        </Card>
      </Reveal>

      {windowStats && (
        <Reveal index={1}>
          <Card padding="none">
            <View style={styles.cardHead}>
              <SectionHeader title={`Over ${range}`} />
            </View>
            <StatRow label="Opening price" value={usd(windowStats.open)} />
            <Divider style={styles.inset} />
            <StatRow label="High" value={usd(windowStats.high)} />
            <Divider style={styles.inset} />
            <StatRow label="Low" value={usd(windowStats.low)} />
          </Card>
        </Reveal>
      )}
    </>
  );

  const secondary = (
    <>
      <Reveal index={isDesktop ? 1 : 2}>
        <Card>
          <SectionHeader title="Your position" />
          <Txt variant="display">{usd(valued.valueUsd)}</Txt>
          <Txt variant="caption" tone="textMuted" style={{ marginTop: space.xxs }}>
            {tokenAmount(defi.amount, defi.symbol)} · {weight(valued.weight)} of the book
          </Txt>
          <Divider style={{ marginVertical: space.md }} />
          <View style={styles.row}>
            <Txt variant="caption" tone="textSecondary">
              Moved today
            </Txt>
            <Txt variant="bodyStrong" tone={valued.change24hUsd >= 0 ? "positive" : "negative"}>
              {usdSigned(valued.change24hUsd)}
            </Txt>
          </View>
        </Card>
      </Reveal>

      <Reveal index={isDesktop ? 2 : 3}>
        <Card>
          <SectionHeader title="Adjust holding" />
          <Field
            label={`${defi.symbol} held`}
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            placeholder="0.00"
            error={error}
          />
          <View style={{ marginTop: space.sm, gap: space.xs }}>
            <Action label="Save amount" variant="primary" onPress={commitAmount} />
            <Action
              label="Remove"
              variant="quiet"
              icon={<TrashIcon size={16} tone={color.negative} />}
              onPress={() => {
                removeAsset(assetId);
                closeAsset();
              }}
            />
          </View>
          <Txt variant="caption" tone="textMuted" style={{ marginTop: space.xs }}>
            Saved to this browser only. Vesper places no orders and holds no keys.
          </Txt>
        </Card>
      </Reveal>
    </>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Tap onPress={closeAsset} accessibilityRole="button" accessibilityLabel="Back to crypto">
          <View style={styles.back}>
            <ChevronLeftIcon size={18} />
            <Txt variant="title" tone="textSecondary">
              Crypto
            </Txt>
          </View>
        </Tap>
        <Txt variant="h1" heading>
          {defi.label}
        </Txt>
        <View style={styles.symbolTag}>
          <Txt variant="micro" tone="accent">
            {defi.symbol}
          </Txt>
        </View>
      </View>
      <Columns primary={primary} secondary={secondary} />
    </Screen>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Txt variant="caption" tone="textSecondary">
        {label}
      </Txt>
      <Txt variant="bodyStrong">{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    flexWrap: "wrap",
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xxs,
  },
  symbolTag: {
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.xs,
    backgroundColor: color.accentSoft,
  },
  priceHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
    flexWrap: "wrap",
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    marginTop: space.xs,
  },
  cardHead: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  inset: {
    marginHorizontal: space.lg,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
