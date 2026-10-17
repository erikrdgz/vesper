/**
 * Exchange.
 *
 * The swap as a room rather than a modal. A sheet is right for a quick
 * conversion you already decided on; a screen is right for the one where
 * you are still deciding, because it has space for the rate, the
 * position you are spending from, what it cost you, and what the swap
 * realises before you commit to it.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useNavigation } from "../hooks/useNavigation";
import { useNetWorth } from "../hooks/useNetWorth";
import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { SWAP_FEE_BPS, SWAP_MESSAGE, quoteSwap, realisedOn } from "../lib/exchange";
import { pct, tokenAmount, usd, usdSigned } from "../lib/format";
import { color, radius, space } from "../theme";
import { isDeFi, type DeFiAsset } from "../types";
import { Column, Row, Screen } from "../components/AppShell";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { CoinMark } from "../components/coins";
import { Field } from "../components/Field";
import { SwapIcon } from "../components/icons";
import { Action, Delta, Divider, Tap, Txt } from "../components/primitives";
import { PriceSourceNote } from "../components/PriceSourceNote";
import { Pane } from "../components/terminal";
import { useToast } from "../components/Toast";
import { TokenObject } from "../components/TokenObject";

export function ExchangeScreen() {
  const { assets, prices, swap, realisedUsd, activity } = useVesper();
  const { openSheet } = useNavigation();
  const { toast } = useToast();
  const netWorth = useNetWorth();
  const { isDesktop } = useResponsive();

  const tokens = useMemo(() => assets.filter(isDeFi), [assets]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flipIndex, setFlipIndex] = useState(0);

  const from = tokens.find((t) => t.id === fromId) ?? tokens[0];
  const to = tokens.find((t) => t.id === toId) ?? tokens.find((t) => t.id !== from?.id);

  const parsed = Number(amount.replace(/[$,\s]/g, "").trim());
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
  const priced = from && to && valid ? quoteSwap(assets, from.id, to.id, parsed, prices.quotes) : null;

  const willRealise =
    from && priced?.ok ? realisedOn(from as DeFiAsset, parsed, priced.quote) : null;

  const fromValued = netWorth.valued.find((entry) => entry.asset.id === from?.id);

  const swaps = activity.filter((entry) => entry.kind === "swap").slice(0, 6);

  function flip() {
    if (!from || !to) return;
    setFromId(to.id);
    setToId(from.id);
    setFlipIndex((index) => index + 1);
    setError(null);
  }

  function submit() {
    if (!from || !to) return;
    if (!valid) return setError("Enter an amount above zero.");

    const received = priced?.ok ? priced.quote.toAmount : null;
    const result = swap(from.id, to.id, parsed);
    if (!result.ok) return setError(SWAP_MESSAGE[result.error]);

    toast(
      "Swapped",
      received === null
        ? undefined
        : `${tokenAmount(parsed, from.symbol)} for ${tokenAmount(received, to.symbol)}` +
          (willRealise === null ? "" : ` · realised ${usdSigned(willRealise)}`),
      willRealise !== null && willRealise < 0 ? "negative" : "positive",
    );
    setAmount("");
    setError(null);
    setFlipIndex((index) => index + 1);
  }

  if (tokens.length < 2) {
    return (
      <Screen>
        <Pane title="Exchange">
          <Txt variant="body" tone="textSecondary">
            You need at least two tokens in the book to swap between them.
          </Txt>
          <Action label="Add a token" variant="primary" onPress={() => openSheet("add-asset")} />
        </Pane>
      </Screen>
    );
  }

  return (
    <Screen>
      <Row flex={1}>
        <Column flex={1.5}>
          <Pane flex={1} title="Swap" minHeight={isDesktop ? undefined : 520}>
            <TokenPicker
              caption="From"
              tokens={tokens}
              selected={from}
              onSelect={setFromId}
              prices={prices.quotes}
            />

            <Field
              label={`Amount in ${from?.symbol ?? ""}`}
              value={amount}
              onChangeText={(next) => {
                setAmount(next);
                setError(null);
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              error={error}
            />

            <View style={styles.balanceRow}>
              <Txt variant="caption" tone="textMuted">
                {from ? `Holding ${tokenAmount(from.amount, from.symbol)}` : ""}
              </Txt>
              {from && (
                <Tap
                  onPress={() => setAmount(String(from.amount))}
                  accessibilityRole="button"
                  accessibilityLabel="Use the whole position"
                >
                  <View style={styles.max}>
                    <Txt variant="micro" tone="accent">
                      MAX
                    </Txt>
                  </View>
                </Tap>
              )}
            </View>

            <Tap onPress={flip} accessibilityRole="button" accessibilityLabel="Reverse the swap">
              <View style={styles.flip}>
                <SwapIcon size={16} tone={color.accent} />
                <Txt variant="micro" tone="textSecondary">
                  REVERSE
                </Txt>
              </View>
            </Tap>

            <TokenPicker
              caption="To"
              tokens={tokens.filter((token) => token.id !== from?.id)}
              selected={to}
              onSelect={setToId}
              prices={prices.quotes}
            />

            {priced?.ok && from && to && (
              <View style={styles.preview}>
                <PreviewRow
                  label="Rate"
                  value={`1 ${from.symbol} = ${priced.quote.rate.toFixed(4)} ${to.symbol}`}
                />
                <PreviewRow label="Value out" value={usd(priced.quote.fromUsd)} />
                <PreviewRow label={`Fee · ${SWAP_FEE_BPS / 100}%`} value={usd(priced.quote.feeUsd)} />
                {willRealise !== null && (
                  <PreviewRow
                    label="Realises"
                    value={usdSigned(willRealise)}
                    tone={willRealise >= 0 ? color.positive : color.negative}
                  />
                )}
                <Divider />
                <PreviewRow
                  label="You receive"
                  value={tokenAmount(priced.quote.toAmount, to.symbol)}
                  strong
                />
              </View>
            )}

            {priced && !priced.ok && (
              <Txt variant="caption" tone="negative">
                {SWAP_MESSAGE[priced.error]}
              </Txt>
            )}

            <Action label="Swap" variant="primary" onPress={submit} disabled={!priced?.ok} />

            <Txt variant="caption" tone="textMuted">
              Nothing is traded. This rewrites your local book at today's prices, moves the cost
              basis across with it, and books whatever the disposal realised — so your return
              stays correct on both sides of the swap.
            </Txt>
          </Pane>
        </Column>

        <Column flex={1}>
          <Pane title="Spending from" minHeight={isDesktop ? undefined : 260}>
            {from && <TokenObject symbol={from.symbol} flipIndex={flipIndex} height={isDesktop ? 170 : 150} />}
            {from && fromValued && (
              <View style={styles.positionFoot}>
                <View>
                  <Txt variant="h2">{from.symbol}</Txt>
                  <Txt variant="micro" tone="textMuted">
                    {tokenAmount(from.amount, from.symbol)}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt variant="mono">{usd(fromValued.valueUsd)}</Txt>
                  {fromValued.gainPct !== null && (
                    <Delta
                      value={fromValued.gainPct}
                      label={`${usdSigned(fromValued.gainUsd ?? 0)} · ${pct(fromValued.gainPct)}`}
                      size="micro"
                    />
                  )}
                </View>
              </View>
            )}
          </Pane>

          <Pane title="Realised so far">
            <AnimatedNumber value={usdSigned(realisedUsd)} variant="h1" />
            <Txt variant="caption" tone="textMuted">
              Gain and loss already taken out of positions by swaps. It has stopped moving with
              the market, which is what makes it different from the return on the overview.
            </Txt>
            <Divider />
            <PriceSourceNote />
          </Pane>

          {swaps.length > 0 && (
            <Pane flex={1} title="Recent swaps" scroll={isDesktop}>
              {swaps.map((entry) => (
                <Txt key={entry.id} variant="caption" tone="textSecondary">
                  {entry.summary}
                </Txt>
              ))}
            </Pane>
          )}
        </Column>
      </Row>
    </Screen>
  );
}

function TokenPicker({
  caption,
  tokens,
  selected,
  onSelect,
  prices,
}: {
  caption: string;
  tokens: DeFiAsset[];
  selected: DeFiAsset | undefined;
  onSelect: (id: string) => void;
  prices: Record<string, { usd: number; change24h: number }>;
}) {
  return (
    <View style={styles.picker}>
      <Txt variant="micro" tone="textMuted">
        {caption}
      </Txt>
      <View style={styles.pickerRow}>
        {tokens.map((token) => {
          const active = token.id === selected?.id;
          return (
            <Tap
              key={token.id}
              onPress={() => onSelect(token.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={token.label}
            >
              <View style={[styles.pickerChip, active && styles.pickerChipActive]}>
                <CoinMark symbol={token.symbol} size={20} />
                <Txt variant="caption" tone={active ? "accentInk" : "textSecondary"}>
                  {token.symbol}
                </Txt>
              </View>
            </Tap>
          );
        })}
      </View>
      {selected && (
        <Txt variant="micro" tone="textMuted">
          {usd(prices[selected.coingeckoId]?.usd ?? 0)} each
        </Txt>
      )}
    </View>
  );
}

function PreviewRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <View style={styles.previewRow}>
      <Txt variant="caption" tone="textSecondary">
        {label}
      </Txt>
      <Txt variant={strong ? "bodyStrong" : "mono"} tone={tone}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    gap: space.xs,
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  pickerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.well,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  pickerChipActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  max: {
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: color.accentSoft,
  },
  flip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.well,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  preview: {
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.well,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  positionFoot: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
});
