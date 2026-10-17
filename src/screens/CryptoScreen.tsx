/**
 * Crypto.
 *
 * The marked-to-market half on its own, because it is the half that moves
 * and the half you would actually act on. Each row carries its own
 * sparkline over a week — the same range Home's chart uses, so the two
 * share one cache entry per coin instead of doubling the request count.
 */

import { StyleSheet, View } from "react-native";

import { useCryptoHoldings } from "../hooks/useNetWorth";
import { useNavigation } from "../hooks/useNavigation";
import { useResponsive } from "../hooks/useResponsive";
import { useAssetSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import { pct, relativeTime, tokenAmount, usd, usdSigned, weight } from "../lib/format";
import { color, space } from "../theme";
import { isDeFi, type DeFiAsset, type ValuedAsset } from "../types";
import { Columns, Screen } from "../components/AppShell";
import { Sparkline } from "../components/Chart";
import { ChevronRightIcon, RefreshIcon } from "../components/icons";
import {
  Action,
  Card,
  Delta,
  Divider,
  SectionHeader,
  Tap,
  Txt,
} from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Reveal } from "../components/Reveal";

export function CryptoScreen() {
  const holdings = useCryptoHoldings();
  const { prices, refreshPrices } = useVesper();
  const { openSheet } = useNavigation();
  const { isDesktop } = useResponsive();

  const total = holdings.reduce((sum, entry) => sum + entry.valueUsd, 0);
  const change = holdings.reduce((sum, entry) => sum + entry.change24hUsd, 0);
  const changePct = total - change > 0 ? (change / (total - change)) * 100 : 0;

  const primary = (
    <>
      <Reveal index={0}>
        <Card gradient>
          <Txt variant="micro" tone="textMuted">
            Crypto holdings
          </Txt>
          <Txt variant="display" style={{ marginTop: space.xxs }}>
            {usd(total)}
          </Txt>
          <View style={styles.deltaRow}>
            <Delta value={changePct} label={pct(changePct)} />
            <Txt variant="caption" tone="textMuted">
              {usdSigned(change)} in 24h
            </Txt>
          </View>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card padding="none">
          <View style={styles.cardHead}>
            <SectionHeader
              title={`${holdings.length} tokens`}
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
          </View>

          {holdings.map((entry, index) => (
            <View key={entry.asset.id}>
              {index > 0 && <Divider style={styles.inset} />}
              <HoldingRow entry={entry} />
            </View>
          ))}

          {holdings.length === 0 && (
            <View style={styles.empty}>
              <Txt variant="bodyStrong">No tokens yet</Txt>
              <Txt variant="caption" tone="textMuted" style={{ marginBottom: space.md }}>
                Add one and it will be valued against live prices.
              </Txt>
              <Action label="Add a token" variant="primary" onPress={() => openSheet("add-asset")} />
            </View>
          )}
        </Card>
      </Reveal>
    </>
  );

  const secondary = (
    <>
      <Reveal index={isDesktop ? 1 : 2}>
        <Card>
          <SectionHeader title="Price feed" />
          <PriceSourceNote />
          <Txt variant="caption" tone="textMuted" style={{ marginTop: space.xs }}>
            Checked {relativeTime(prices.fetchedAt)}. CoinGecko's free tier is shared by everyone on
            your network, so Vesper asks at most once a minute.
          </Txt>
        </Card>
      </Reveal>

      <Reveal index={isDesktop ? 2 : 3}>
        <Card>
          <SectionHeader title="Weight in the book" />
          {holdings.map((entry) => (
            <View key={entry.asset.id} style={styles.weightRow}>
              <Txt variant="caption" tone="textSecondary" style={{ flex: 1 }}>
                {isDeFi(entry.asset) ? entry.asset.symbol : entry.asset.label}
              </Txt>
              <View style={styles.weightTrack}>
                <View style={[styles.weightFill, { flex: Math.max(entry.weight, 0.001) }]} />
                <View style={{ flex: Math.max(1 - entry.weight, 0.001) }} />
              </View>
              <Txt variant="caption" tone="text">
                {weight(entry.weight)}
              </Txt>
            </View>
          ))}
        </Card>
      </Reveal>
    </>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="h1" heading>
          Crypto
        </Txt>
      </View>
      <Columns primary={primary} secondary={secondary} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

/**
 * One holding.
 *
 * The sparkline hook lives in the row rather than the list, so each row
 * owns its own fetch and a slow coin cannot hold up the others.
 */
function HoldingRow({ entry }: { entry: ValuedAsset }) {
  const { openAsset } = useNavigation();
  const asset = entry.asset as DeFiAsset;
  const { prices } = useVesper();
  const price = prices.quotes[asset.coingeckoId]?.usd ?? 0;
  const series = useAssetSeries(asset.coingeckoId, "1W", price);

  const up = entry.change24hPct >= 0;

  return (
    <Tap
      onPress={() => openAsset(asset.id)}
      accessibilityRole="button"
      accessibilityLabel={`${asset.label}, ${usd(entry.valueUsd)}`}
      scaleTo={0.99}
    >
      <View style={styles.holding}>
        <View style={styles.holdingCopy}>
          <Txt variant="bodyStrong">{asset.label}</Txt>
          <Txt variant="caption" tone="textMuted">
            {tokenAmount(asset.amount, asset.symbol)}
          </Txt>
        </View>

        <Sparkline
          points={series.points}
          tone={up ? color.positive : color.negative}
          width={56}
          height={26}
        />

        <View style={styles.holdingValue}>
          <Txt variant="bodyStrong">{entry.priced ? usd(entry.valueUsd) : "No price"}</Txt>
          {entry.priced && (
            <Delta value={entry.change24hPct} label={pct(entry.change24hPct)} size="micro" />
          )}
        </View>

        <ChevronRightIcon size={16} tone={color.textMuted} />
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  holding: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  holdingCopy: {
    flex: 1,
    gap: 2,
  },
  holdingValue: {
    alignItems: "flex-end",
    gap: 2,
  },
  empty: {
    padding: space.lg,
    gap: space.xxs,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xs,
  },
  weightTrack: {
    flexDirection: "row",
    flex: 2,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.well,
    overflow: "hidden",
  },
  weightFill: {
    backgroundColor: color.accent,
  },
});
