/**
 * Crypto.
 *
 * Master and detail, with the 3D token as the hinge between them. Picking
 * a row flips the prism to that token and swaps the readout beside it, so
 * the selection has a physical consequence rather than just a highlighted
 * row. The full detail screen is still a click further in, for the ranges
 * and the position controls.
 */

import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useMeasure } from "../hooks/useMeasure";
import { useChangeFlash } from "../hooks/useInteraction";
import { useNavigation } from "../hooks/useNavigation";
import { useCryptoHoldings } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { useAssetSeries } from "../hooks/useSeries";
import { useVesper } from "../hooks/useVesper";
import { pct, relativeTime, tokenAmount, usd, usdSigned, weight } from "../lib/format";
import { color, space } from "../theme";
import { isDeFi, type DeFiAsset, type ValuedAsset } from "../types";
import { Column, Row, Screen } from "../components/AppShell";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { AreaChart, Sparkline } from "../components/Chart";
import { ArrowUpRightIcon, RefreshIcon } from "../components/icons";
import { Action, Delta, Divider, Tap, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";
import { TokenObject, tokenColor } from "../components/TokenObject";

export function CryptoScreen() {
  const holdings = useCryptoHoldings();
  const { prices, refreshPrices } = useVesper();
  const { openSheet } = useNavigation();
  const { isDesktop } = useResponsive();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    holdings.find((entry) => entry.asset.id === selectedId) ?? holdings[0] ?? null;

  /**
   * Half-turns accumulated, one per selection.
   *
   * Counting turns rather than setting an absolute angle means the prism
   * always rotates onward to the next token instead of unwinding back
   * through the one before it.
   */
  const flipIndex = useRef(0);
  const previousId = useRef(selected?.asset.id);
  useEffect(() => {
    if (selected && previousId.current !== selected.asset.id) {
      previousId.current = selected.asset.id;
      flipIndex.current += 1;
    }
  }, [selected]);

  const total = holdings.reduce((sum, entry) => sum + entry.valueUsd, 0);
  const change = holdings.reduce((sum, entry) => sum + entry.change24hUsd, 0);
  const changePct = total - change > 0 ? (change / (total - change)) * 100 : 0;

  return (
    <Screen>
      <Row flex={1}>
        <Column flex={1.5}>
          <Pane
            title="Crypto holdings"
            minHeight={isDesktop ? undefined : 150}
            action={
              <View style={styles.headRight}>
                <Delta
                  value={changePct}
                  label={`${changePct >= 0 ? "▲" : "▼"} ${pct(changePct).replace(/[+−]/, "")}`}
                />
                <Txt variant="mono" tone="textMuted">
                  {usdSigned(change)} · 24h
                </Txt>
              </View>
            }
          >
            <AnimatedNumber value={usd(total)} variant="display" />
          </Pane>

          <Pane
            flex={1}
            title={`${holdings.length} tokens`}
            scroll={isDesktop}
            flush
            action={
              <Tap
                onPress={() => refreshPrices({ force: true })}
                accessibilityRole="button"
                accessibilityLabel="Refresh prices"
              >
                <RefreshIcon size={14} tone={prices.loading ? color.accent : color.textMuted} />
              </Tap>
            }
          >
            {holdings.map((entry, index) => (
              <View key={entry.asset.id}>
                {index > 0 && <Divider />}
                <HoldingRow
                  entry={entry}
                  selected={selected?.asset.id === entry.asset.id}
                  onSelect={() => setSelectedId(entry.asset.id)}
                />
              </View>
            ))}

            {holdings.length === 0 && (
              <View style={styles.empty}>
                <Txt variant="bodyStrong">No tokens yet</Txt>
                <Txt variant="caption" tone="textMuted">
                  Add one and it will be valued against live prices.
                </Txt>
                <Action
                  label="Add a token"
                  variant="primary"
                  onPress={() => openSheet("add-asset")}
                />
              </View>
            )}
          </Pane>
        </Column>

        <Column flex={1}>
          <Pane flex={1.1} title="Selected" minHeight={isDesktop ? undefined : 240}>
            {selected && isDeFi(selected.asset) ? (
              <TokenObject
                symbol={(selected.asset as DeFiAsset).symbol}
                flipIndex={flipIndex.current}
                height={isDesktop ? 200 : 180}
              />
            ) : (
              <Txt variant="caption" tone="textMuted">
                Nothing to show.
              </Txt>
            )}
          </Pane>

          {selected && <SelectedDetail entry={selected} />}

          <Pane title="Price feed">
            <PriceSourceNote />
            <Txt variant="caption" tone="textMuted">
              Checked {relativeTime(prices.fetchedAt)}. CoinGecko's free tier is shared by everyone
              on your network, so Vesper asks at most once a minute.
            </Txt>
          </Pane>
        </Column>
      </Row>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function SelectedDetail({ entry }: { entry: ValuedAsset }) {
  const asset = entry.asset as DeFiAsset;
  const { prices } = useVesper();
  const { openAsset } = useNavigation();
  const { isDesktop } = useResponsive();
  const price = prices.quotes[asset.coingeckoId]?.usd ?? 0;
  const series = useAssetSeries(asset.coingeckoId, "1W", price);
  const measured = useMeasure();

  const tone = entry.change24hPct >= 0 ? color.positive : color.negative;

  return (
    <Pane
      flex={1}
      minHeight={isDesktop ? undefined : 220}
      title={asset.label}
      action={
        <Tap
          onPress={() => openAsset(asset.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${asset.label} detail`}
        >
          <ArrowUpRightIcon size={14} tone={color.accent} />
        </Tap>
      }
    >
      <View style={styles.selectedHead}>
        <View>
          <Txt variant="mono" tone="textMuted">
            {tokenAmount(asset.amount, asset.symbol)}
          </Txt>
          <AnimatedNumber value={usd(entry.valueUsd)} variant="h1" />
        </View>
        <View style={styles.selectedStats}>
          <Txt variant="mono" tone={entry.change24hPct >= 0 ? "positive" : "negative"}>
            {entry.change24hPct >= 0 ? "▲" : "▼"} {pct(entry.change24hPct).replace(/[+−]/, "")}
          </Txt>
          <Txt variant="micro" tone="textMuted">
            {weight(entry.weight)} of book
          </Txt>
        </View>
      </View>

      <View style={styles.selectedChart} onLayout={measured.onLayout}>
        {measured.ready && (
          <AreaChart
            points={series.points}
            width={measured.width}
            height={measured.height}
            tone={tone}
            gridLines={0}
            marker={false}
          />
        )}
      </View>
    </Pane>
  );
}

function HoldingRow({
  entry,
  selected,
  onSelect,
}: {
  entry: ValuedAsset;
  selected: boolean;
  onSelect: () => void;
}) {
  const asset = entry.asset as DeFiAsset;
  const { prices } = useVesper();
  const price = prices.quotes[asset.coingeckoId]?.usd ?? 0;
  const series = useAssetSeries(asset.coingeckoId, "1W", price);
  const flash = useChangeFlash(Math.round(entry.valueUsd * 100));

  const up = entry.change24hPct >= 0;
  const metal = tokenColor(asset.symbol);

  return (
    <Tap
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${asset.label}, ${usd(entry.valueUsd)}`}
      scaleTo={0.995}
    >
      <View
        style={[
          styles.holding,
          selected && styles.holdingSelected,
          flash === "up" && styles.flashUp,
          flash === "down" && styles.flashDown,
        ]}
      >
        <View style={[styles.tick, { backgroundColor: selected ? metal : "transparent" }]} />
        <View style={styles.holdingCopy}>
          <Txt variant="bodyStrong">{asset.label}</Txt>
          <Txt variant="micro" tone="textMuted">
            {tokenAmount(asset.amount, asset.symbol)} · {usd(price)}
          </Txt>
        </View>

        <Sparkline
          points={series.points}
          tone={up ? color.positive : color.negative}
          width={56}
          height={26}
        />

        <View style={styles.holdingValue}>
          <Txt variant="mono">{entry.priced ? usd(entry.valueUsd) : "—"}</Txt>
          <Txt variant="micro" tone={up ? "positive" : "negative"}>
            {up ? "▲" : "▼"} {pct(entry.change24hPct).replace(/[+−]/, "")}
          </Txt>
        </View>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  headRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  holding: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  holdingSelected: {
    backgroundColor: color.card,
  },
  tick: {
    width: 3,
    height: 28,
    borderRadius: 2,
  },
  holdingCopy: {
    flex: 1,
    gap: 2,
  },
  holdingValue: {
    alignItems: "flex-end",
    gap: 2,
  },
  flashUp: {
    backgroundColor: color.positiveSoft,
  },
  flashDown: {
    backgroundColor: color.negativeSoft,
  },
  empty: {
    padding: space.md,
    gap: space.xs,
    alignItems: "flex-start",
  },
  selectedHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  selectedStats: {
    alignItems: "flex-end",
    gap: 2,
  },
  selectedChart: {
    flex: 1,
    minHeight: 70,
    marginHorizontal: -space.md,
    marginBottom: -space.md,
  },
});
