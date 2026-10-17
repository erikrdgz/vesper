/**
 * Wallet.
 *
 * Who you are, what you hold, and the disclosures — in that order. On a
 * phone this is the screen you land on from the bottom bar, so it opens
 * with the profile and the balance rather than with a list of toggles.
 *
 * A dashboard that shows someone a six-figure net worth owes them a
 * plain account of where the data lives and what it is worth, and
 * burying that in a footer link would be the cowardly version.
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useNetWorth } from "../hooks/useNetWorth";
import { useNavigation } from "../hooks/useNavigation";
import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { plural, relativeTime, transactionDate, usd, usdSigned } from "../lib/format";
import { downloadCsv, pickCsv } from "../lib/download";
import { parsePositions, type ImportResult } from "../lib/importCsv";
import { useToast } from "../components/Toast";
import { positionsCsv } from "../lib/exportCsv";
import { color, radius, space } from "../theme";
import { isDeFi } from "../types";
import { TOKEN_CATALOG } from "../data/catalog";
import { Column, Row, Screen } from "../components/AppShell";
import { CoinMark } from "../components/coins";
import { CARD_HEIGHT, CARD_PEEK, TokenCard } from "../components/TokenCard";
import { Field, ToggleRow } from "../components/Field";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { RefreshIcon, TrashIcon } from "../components/icons";
import { Action, Avatar, Divider, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";

export function WalletScreen() {
  const {
    assets,
    prices,
    refreshPrices,
    reduceMotion,
    reduceMotionOverride,
    systemReduceMotion,
    setReduceMotion,
    resetToSeed,
    watchlist,
    toggleWatch,
    activity,
    profile,
    setProfile,
    realisedUsd,
    replaceAssets,
    logActivity,
    captureBook,
    restoreBook,
  } = useVesper();
  const { toast, toastUndo } = useToast();
  const netWorth = useNetWorth();
  const { isDesktop } = useResponsive();
  const { openSheet, setTab, openAsset } = useNavigation();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [exported, setExported] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null);

  /**
   * The deck, in a fixed order.
   *
   * Picking a card used to move it to the end of this list so that it
   * was painted last and nothing covered its body. That works, and it
   * costs a reorder: every card below the one you touched jumped a slot
   * in a single frame. The order is stable now and the card is raised
   * where it stands, over its neighbours, under a spring.
   */
  const holdings = useMemo(
    () => netWorth.valued.filter((entry) => isDeFi(entry.asset)),
    [netWorth.valued],
  );

  // Nothing picked yet: the front of a downward stack is the card on
  // top of it — the last one — and the front of a rail is the one you
  // read first. The glow belongs to whichever that is.
  const defaultFront = isDesktop ? holdings[0] : holdings[holdings.length - 1];
  const frontCard = selectedCard ?? defaultFront?.asset.id ?? null;

  const tokens = assets.filter(isDeFi).length;

  return (
    <Screen>
      <Row flex={1}>
        <Column flex={2.2}>
          <Pane minHeight={isDesktop ? undefined : 280}>
            <View style={styles.identity}>
              <Avatar name={profile.name} size={64} />
              <View style={{ flex: 1 }}>
                <Txt variant="h1" heading>
                  {profile.name}
                </Txt>
                <Txt variant="caption" tone="textMuted">
                  {profile.handle} · {profile.plan}
                </Txt>
              </View>
            </View>

            <View style={styles.balanceBlock}>
              <Txt variant="micro" tone="textMuted">
                Net worth
              </Txt>
              <AnimatedNumber value={usd(netWorth.totalUsd)} variant="display" />
              <View style={styles.balanceMeta}>
                <Txt variant="mono" tone={netWorth.gainUsd >= 0 ? "positive" : "negative"}>
                  {usdSigned(netWorth.gainUsd)} unrealised
                </Txt>
                <Txt variant="mono" tone={realisedUsd >= 0 ? "positive" : "negative"}>
                  {usdSigned(realisedUsd)} realised
                </Txt>
              </View>
            </View>

            <View style={styles.tiles}>
              <Tile label="Plan" value={profile.plan} accent />
              <Tile label="Accounts" value={String(assets.length - tokens)} />
              <Tile label="Tokens" value={String(tokens)} />
              <Tile label="Following" value={String(watchlist.length)} />
            </View>
          </Pane>

          <Pane
            title={`Cards · ${plural(holdings.length, "token")}`}
            minHeight={isDesktop ? undefined : 360}
            action={
              holdings.length > 0 ? (
                <Txt variant="mono" tone="textMuted">
                  {usd(netWorth.deFiUsd)}
                </Txt>
              ) : null
            }
          >
            {holdings.length === 0 ? (
              <>
                <Txt variant="caption" tone="textSecondary">
                  No tokens yet. Each one you add gets its own card here.
                </Txt>
                <Action label="Add a token" onPress={() => openSheet("add-asset")} />
              </>
            ) : (
              <Deck horizontal={isDesktop}>
                {holdings.map((entry, index) => (
                  <TokenCard
                    key={entry.asset.id}
                    entry={entry}
                    index={index}
                    layout={isDesktop ? "rail" : "stack"}
                    active={selectedCard === entry.asset.id}
                    glow={frontCard === entry.asset.id}
                    overlap={CARD_HEIGHT - CARD_PEEK}
                    onPress={() => {
                      // Tapping the front card opens it; tapping any
                      // other brings it to the front first, which is how
                      // a stack of cards behaves in a hand.
                      if (selectedCard === entry.asset.id) {
                        setTab("crypto");
                        openAsset(entry.asset.id);
                      } else {
                        setSelectedCard(entry.asset.id);
                      }
                    }}
                  />
                ))}
              </Deck>
            )}
          </Pane>

          <Pane title="Your details">
            <Field
              label="Name"
              value={profile.name}
              onChangeText={(name) => setProfile({ name })}
              placeholder="Leonard Lopez"
            />
            <Field
              label="Handle"
              value={profile.handle}
              onChangeText={(handle) => setProfile({ handle })}
              placeholder="@leonardlopez"
            />
            <Txt variant="caption" tone="textMuted">
              Stored in this browser. There is no account to sign in to and nothing is sent
              anywhere — the greeting on the overview reads from here.
            </Txt>
          </Pane>

          <Pane flex={1} title="What this is" minHeight={isDesktop ? undefined : 220}>
            <Txt variant="body" tone="textSecondary">
              Vesper connects to no bank and holds no keys. The accounts are seeded mock data you
              can edit, kept in this browser and sent nowhere.
            </Txt>
            <Txt variant="body" tone="textSecondary">
              The one network call it makes is to CoinGecko's public price endpoint. Crypto values
              are real. Everything else is a number you typed.
            </Txt>
            <Divider />
            <Txt variant="caption" tone="textMuted">
              Built with React Native primitives and compiled to the web by Expo. The same
              components would run on a phone.
            </Txt>
          </Pane>

          <Pane title="Watchlist">
            <Txt variant="caption" tone="textSecondary">
              What appears in the rail along the bottom. Following a token costs nothing extra —
              every price on screen comes from one request.
            </Txt>
            <View style={styles.chips}>
              {TOKEN_CATALOG.map((entry) => {
                const on = watchlist.includes(entry.coingeckoId);
                return (
                  <Pressable
                    key={entry.coingeckoId}
                    onPress={() => toggleWatch(entry.coingeckoId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Follow ${entry.label}`}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <CoinMark symbol={entry.symbol} size={16} />
                    <Txt variant="micro" tone={on ? "accentInk" : "textSecondary"}>
                      {entry.symbol}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </Pane>

          <Pane title="Motion">
            <ToggleRow
              label="Reduce motion"
              description={
                reduceMotionOverride === null
                  ? `Following your system setting, which is currently ${systemReduceMotion ? "on" : "off"}.`
                  : "Set here, overriding your system setting."
              }
              value={reduceMotion}
              onChange={(value) =>
                // Returning to the system setting needs a third state, so
                // switching it back off while the OS also wants it off is
                // read as "stop overriding" rather than "force off".
                setReduceMotion(value === systemReduceMotion ? null : value)
              }
            />
          </Pane>
        </Column>

        <Column flex={1}>
          <Pane title="Price feed">
            <PriceSourceNote />
            <Txt variant="caption" tone="textMuted">
              Last checked {relativeTime(prices.fetchedAt)}.
            </Txt>
            <Action
              label="Refresh now"
              onPress={() => refreshPrices({ force: true })}
              icon={<RefreshIcon size={16} />}
            />
          </Pane>

          <Pane
            flex={1}
            title={`Activity · ${activity.length}`}
            scroll={isDesktop}
            minHeight={isDesktop ? undefined : 180}
          >
            {activity.length === 0 ? (
              <Txt variant="caption" tone="textMuted">
                Nothing yet. Swaps, additions and triggered alerts land here, so a book that
                changed under you can say what happened.
              </Txt>
            ) : (
              activity.map((entry) => (
                <View key={entry.id} style={styles.activityRow}>
                  <View style={styles.activityDot} />
                  <Txt variant="caption" tone="textSecondary" style={{ flex: 1 }}>
                    {entry.summary}
                  </Txt>
                  <Txt variant="micro" tone="textMuted">
                    {transactionDate(entry.at)}
                  </Txt>
                </View>
              ))
            )}
          </Pane>

          <Pane title="Your data">
            <Txt variant="caption" tone="textSecondary">
              Every position with its cost and return, as a spreadsheet. The numbers are yours
              and they live in your browser; this is the door out.
            </Txt>
            <Action
              label={exported ? "Downloaded" : "Export positions as CSV"}
              onPress={() => {
                const ok = downloadCsv(
                  `vesper-positions-${new Date().toISOString().slice(0, 10)}.csv`,
                  positionsCsv(netWorth),
                );
                setExported(ok);
              }}
            />

            {pendingImport ? (
              <>
                <Txt variant="caption" tone="negative">
                  Replace your {plural(assets.length, "position")} with the{" "}
                  {plural(pendingImport.assets.length, "position")} in that file? You will get a
                  few seconds to undo it.
                </Txt>
                {pendingImport.skipped.length > 0 && (
                  <Txt variant="caption" tone="textMuted">
                    {plural(pendingImport.skipped.length, "row")} will be left out:{" "}
                    {pendingImport.skipped.slice(0, 2).join(" ")}
                  </Txt>
                )}
                <Action
                  label="Replace the book"
                  variant="primary"
                  onPress={() => {
                    const before = captureBook();
                    replaceAssets(pendingImport.assets);
                    logActivity(
                      "edit",
                      `Imported ${plural(pendingImport.assets.length, "position")} from a file`,
                    );
                    toastUndo(
                      "Book replaced",
                      `${plural(pendingImport.assets.length, "position")} imported`,
                      () => restoreBook(before),
                    );
                    setPendingImport(null);
                  }}
                />
                <Action label="Cancel" onPress={() => setPendingImport(null)} />
              </>
            ) : (
              <Action
                label="Import positions from CSV"
                onPress={async () => {
                  const text = await pickCsv();
                  if (text === null) return; // cancelled, which is not an error
                  const result = parsePositions(text);
                  if (result.assets.length === 0) {
                    toast(
                      "Nothing to import",
                      result.skipped[0] ?? "No rows in that file matched.",
                      "negative",
                    );
                    return;
                  }
                  setPendingImport(result);
                }}
              />
            )}
          </Pane>

          <Pane title="Stored data">
            <Txt variant="caption" tone="textSecondary">
              Your accounts, holdings and preferences live under one key in this browser's local
              storage. Price history is cached separately for an hour, so a reload costs CoinGecko
              nothing.
            </Txt>

            {confirmingReset ? (
              <>
                <Txt variant="caption" tone="negative">
                  This discards every edit you have made. You will get a few seconds to undo it,
                  and after that it is gone.
                </Txt>
                <Action
                  label="Yes, reset everything"
                  variant="primary"
                  onPress={() => {
                    const before = captureBook();
                    void resetToSeed();
                    toastUndo("Reset to the seeded book", "Every edit was discarded.", () =>
                      restoreBook(before),
                    );
                    setConfirmingReset(false);
                  }}
                />
                <Action label="Keep my data" onPress={() => setConfirmingReset(false)} />
              </>
            ) : (
              <Action
                label="Reset to seeded data"
                variant="quiet"
                icon={<TrashIcon size={16} tone={color.negative} />}
                onPress={() => setConfirmingReset(true)}
              />
            )}
          </Pane>
        </Column>
      </Row>
    </Screen>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.tile, accent && styles.tileAccent]}>
      <Txt variant="micro" tone={accent ? "accentInk" : "textMuted"}>
        {label}
      </Txt>
      <Txt variant="h2" tone={accent ? "accentInk" : "text"}>
        {value}
      </Txt>
    </View>
  );
}

/**
 * The deck: a hand on a phone, a rail in a window.
 *
 * Stacked cards are the right answer at 330pt, where there is room for
 * one card and a glimpse of the next. Given a window the same stack is
 * a column of slivers with acres of empty beside it — so the cards go
 * side by side, face up, and the row scrolls.
 */
function Deck({ horizontal, children }: { horizontal: boolean; children: React.ReactNode }) {
  if (!horizontal) return <View style={styles.deck}>{children}</View>;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.rail}
      contentContainerStyle={styles.railRun}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  balanceBlock: {
    gap: 2,
    paddingVertical: space.sm,
  },
  balanceMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  tile: {
    flexGrow: 1,
    minWidth: 120,
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.xs,
    backgroundColor: color.card,
  },
  tileAccent: {
    backgroundColor: color.accent,
  },
  deck: {
    // The cards overlap via each card's own negative margin, so the
    // container only needs to stop them being clipped as they lift.
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  rail: {
    // A lifted card grows past its slot in both directions, and a
    // scroller clips to its own box, so the run carries the room.
    marginHorizontal: -space.sm,
  },
  railRun: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xxs,
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    backgroundColor: color.well,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  chipOn: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xxs,
  },
  activityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.textMuted,
  },
});
