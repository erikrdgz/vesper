/**
 * Watch.
 *
 * The catalogue, searchable, with a follow toggle per row. Following a
 * token puts it in the rail along the foot of every screen, which is the
 * only reason this tab exists — a watchlist you cannot edit from one
 * place ends up edited from four.
 *
 * Deliberately no sparklines. One history request per row would be eight
 * on a cold load against a rate limit the whole app already works
 * around, and a follow list is read for price and direction, not shape.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { TOKEN_CATALOG, type CatalogEntry } from "../data/catalog";
import { useChangeFlash } from "../hooks/useInteraction";
import { useNavigation } from "../hooks/useNavigation";
import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { pct, relativeTime, tokenAmount, usd } from "../lib/format";
import { color, radius, space } from "../theme";
import { isDeFi } from "../types";
import { Column, Row, Screen } from "../components/AppShell";
import { CoinMark } from "../components/coins";
import { Field } from "../components/Field";
import { ArrowUpRightIcon } from "../components/icons";
import { Action, Delta, Divider, Tap, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";
import { useToast } from "../components/Toast";

export function WatchScreen() {
  const { assets, watchlist, prices, toggleWatch, alerts, removeAlert } = useVesper();
  const { openSheet, setTab, openAsset } = useNavigation();
  const { toast } = useToast();
  const { isDesktop } = useResponsive();
  const [query, setQuery] = useState("");

  const held = useMemo(
    () => new Map(assets.filter(isDeFi).map((asset) => [asset.coingeckoId, asset])),
    [assets],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? TOKEN_CATALOG.filter(
          (entry) =>
            entry.symbol.toLowerCase().includes(needle) ||
            entry.label.toLowerCase().includes(needle),
        )
      : TOKEN_CATALOG;

    // Followed first, then held, then the rest. Searching flattens that
    // order, because when you are searching you want what you typed.
    if (needle) return [...matched];
    return [...matched].sort((a, b) => {
      const score = (entry: CatalogEntry) =>
        (watchlist.includes(entry.coingeckoId) ? 2 : 0) + (held.has(entry.coingeckoId) ? 1 : 0);
      return score(b) - score(a);
    });
  }, [query, watchlist, held]);

  const armed = alerts.filter((alert) => alert.triggeredAt === null);
  const fired = alerts.filter((alert) => alert.triggeredAt !== null);

  return (
    <Screen>
      <Row flex={1}>
        <Column flex={2}>
          <Pane
            title={`Watching ${watchlist.length} of ${TOKEN_CATALOG.length}`}
            minHeight={isDesktop ? undefined : 110}
            action={<PriceSourceNote compact />}
          >
            <Field label="Search" value={query} onChangeText={setQuery} placeholder="Bitcoin" />
          </Pane>

          <Pane flex={1} scroll={isDesktop} flush minHeight={isDesktop ? undefined : 420}>
            {rows.map((entry, index) => (
              <View key={entry.coingeckoId}>
                {index > 0 && <Divider />}
                <WatchRow
                  entry={entry}
                  following={watchlist.includes(entry.coingeckoId)}
                  holding={held.get(entry.coingeckoId)?.amount ?? null}
                  price={prices.quotes[entry.coingeckoId]?.usd ?? 0}
                  change={prices.quotes[entry.coingeckoId]?.change24h ?? 0}
                  onToggle={() => {
                    const wasFollowing = watchlist.includes(entry.coingeckoId);
                    toggleWatch(entry.coingeckoId);
                    toast(
                      wasFollowing ? `Unfollowed ${entry.label}` : `Following ${entry.label}`,
                      wasFollowing ? undefined : "It is in the bar at the top now.",
                    );
                  }}
                  onOpen={() => {
                    const asset = held.get(entry.coingeckoId);
                    if (!asset) return;
                    setTab("crypto");
                    openAsset(asset.id);
                  }}
                />
              </View>
            ))}

            {rows.length === 0 && (
              <View style={styles.empty}>
                <Txt variant="bodyStrong">Nothing matches "{query}"</Txt>
                <Txt variant="caption" tone="textMuted">
                  Vesper knows {TOKEN_CATALOG.length} tokens. It is a demo, not an exchange.
                </Txt>
              </View>
            )}
          </Pane>
        </Column>

        <Column flex={1}>
          <Pane
            title={`Alerts · ${armed.length} armed`}
            minHeight={isDesktop ? undefined : 200}
            action={
              <Tap
                onPress={() => openSheet("alert")}
                accessibilityRole="button"
                accessibilityLabel="Set a price alert"
              >
                <ArrowUpRightIcon size={14} tone={color.accent} />
              </Tap>
            }
          >
            {alerts.length === 0 ? (
              <>
                <Txt variant="caption" tone="textSecondary">
                  Nothing armed. An alert fires once when its price is crossed, while this tab is
                  open — Vesper has no server to watch it for you.
                </Txt>
                <Action label="Set an alert" onPress={() => openSheet("alert")} />
              </>
            ) : (
              <>
                {armed.map((alert) => (
                  <View key={alert.id} style={styles.alertRow}>
                    <View style={[styles.alertDot, { backgroundColor: color.accent }]} />
                    <Txt variant="caption" tone="text" style={{ flex: 1 }}>
                      {alert.symbol} {alert.direction} {usd(alert.priceUsd)}
                    </Txt>
                    <Tap
                      onPress={() => removeAlert(alert.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${alert.symbol} alert`}
                    >
                      <Txt variant="micro" tone="textMuted">
                        CLEAR
                      </Txt>
                    </Tap>
                  </View>
                ))}

                {fired.length > 0 && <Divider style={{ marginVertical: space.xs }} />}
                {fired.map((alert) => (
                  <View key={alert.id} style={styles.alertRow}>
                    <View style={[styles.alertDot, { backgroundColor: color.positive }]} />
                    <Txt variant="caption" tone="textMuted" style={{ flex: 1 }}>
                      {alert.symbol} went {alert.direction} {usd(alert.priceUsd)} ·{" "}
                      {relativeTime(alert.triggeredAt)}
                    </Txt>
                    <Tap
                      onPress={() => removeAlert(alert.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Dismiss ${alert.symbol} alert`}
                    >
                      <Txt variant="micro" tone="textMuted">
                        CLEAR
                      </Txt>
                    </Tap>
                  </View>
                ))}
              </>
            )}
          </Pane>
        </Column>
      </Row>
    </Screen>
  );
}

function WatchRow({
  entry,
  following,
  holding,
  price,
  change,
  onToggle,
  onOpen,
}: {
  entry: CatalogEntry;
  following: boolean;
  holding: number | null;
  price: number;
  change: number;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const flash = useChangeFlash(Math.round(price * 100));

  return (
    <View
      style={[
        styles.row,
        flash === "up" && styles.flashUp,
        flash === "down" && styles.flashDown,
      ]}
    >
      <Tap
        onPress={onOpen}
        disabled={holding === null}
        accessibilityRole={holding === null ? "text" : "button"}
        accessibilityLabel={`${entry.label}, ${usd(price)}`}
        scaleTo={0.995}
        style={styles.rowMain}
      >
        <View style={styles.rowInner}>
          <CoinMark symbol={entry.symbol} size={30} />
          <View style={styles.rowCopy}>
            <Txt variant="bodyStrong">{entry.label}</Txt>
            <Txt variant="micro" tone="textMuted">
              {holding !== null ? `Holding ${tokenAmount(holding, entry.symbol)}` : entry.symbol}
            </Txt>
          </View>
          <View style={styles.rowValue}>
            <Txt variant="mono">{price > 0 ? usd(price) : "—"}</Txt>
            <Delta
              value={change}
              label={`${change >= 0 ? "▲" : "▼"} ${pct(change).replace(/[+−]/, "")}`}
              size="micro"
            />
          </View>
        </View>
      </Tap>

      <Tap
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: following }}
        accessibilityLabel={`${following ? "Unfollow" : "Follow"} ${entry.label}`}
      >
        <View style={[styles.follow, following && styles.followOn]}>
          <Txt variant="micro" tone={following ? "accentInk" : "textSecondary"}>
            {following ? "FOLLOWING" : "FOLLOW"}
          </Txt>
        </View>
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  rowMain: {
    flex: 1,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowValue: {
    alignItems: "flex-end",
    gap: 2,
  },
  follow: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.well,
  },
  followOn: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  flashUp: {
    backgroundColor: color.positiveSoft,
  },
  flashDown: {
    backgroundColor: color.negativeSoft,
  },
  empty: {
    padding: space.md,
    gap: space.xxs,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xxs,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
