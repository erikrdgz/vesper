/**
 * The two sheets behind the add button.
 *
 * Adding an asset is the one place someone can change what the dashboard
 * is worth, so the validation here is stricter than the rest of the app:
 * a balance that fails to parse silently becomes NaN, and NaN propagates
 * through every total on every screen before anyone notices.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useNavigation } from "../hooks/useNavigation";
import { useVesper } from "../hooks/useVesper";
import { usd } from "../lib/format";
import { color, space } from "../theme";
import { isTradFi, type Asset, type TradFiKind } from "../types";
import { ChoiceRow, Field } from "./Field";
import { Action, Divider, Txt } from "./primitives";
import { Sheet } from "./Sheet";

/** Tokens someone can add without knowing CoinGecko's internal ids. */
const TOKEN_CATALOG = [
  { symbol: "BTC", label: "Bitcoin", coingeckoId: "bitcoin" },
  { symbol: "ETH", label: "Ethereum", coingeckoId: "ethereum" },
  { symbol: "SOL", label: "Solana", coingeckoId: "solana" },
  { symbol: "LINK", label: "Chainlink", coingeckoId: "chainlink" },
  { symbol: "ADA", label: "Cardano", coingeckoId: "cardano" },
  { symbol: "DOT", label: "Polkadot", coingeckoId: "polkadot" },
  { symbol: "AVAX", label: "Avalanche", coingeckoId: "avalanche-2" },
  { symbol: "MATIC", label: "Polygon", coingeckoId: "matic-network" },
] as const;

const KINDS: { value: TradFiKind; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "brokerage", label: "Brokerage" },
  { value: "retirement", label: "Retirement" },
  { value: "credit", label: "Credit" },
];

/**
 * Parse a user-typed amount.
 *
 * Returns null rather than NaN, so the caller has to deal with it.
 */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/* ------------------------------------------------------------------ */

export function AddAssetSheet() {
  const { sheet, closeSheet } = useNavigation();
  const { addAsset, refreshPrices } = useVesper();

  const [bucket, setBucket] = useState<"tradfi" | "defi">("tradfi");
  const [institution, setInstitution] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<TradFiKind>("cash");
  const [balance, setBalance] = useState("");
  const [token, setToken] = useState<string>("bitcoin");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setInstitution("");
    setLabel("");
    setBalance("");
    setAmount("");
    setErrors({});
  }

  function submit() {
    const next: Record<string, string> = {};

    if (bucket === "tradfi") {
      if (!label.trim()) next.label = "Give the account a name.";
      const parsed = parseAmount(balance);
      if (parsed === null) next.balance = "Enter a balance, like 4500.";

      if (Object.keys(next).length > 0) return setErrors(next);

      const asset: Asset = {
        id: `tf-${Date.now()}`,
        class: "tradfi",
        kind,
        institution: institution.trim() || label.trim(),
        label: label.trim(),
        balanceUsd: parsed!,
      };
      addAsset(asset);
    } else {
      const parsed = parseAmount(amount);
      if (parsed === null) next.amount = "Enter how many tokens you hold.";
      if (Object.keys(next).length > 0) return setErrors(next);

      const entry = TOKEN_CATALOG.find((candidate) => candidate.coingeckoId === token);
      if (!entry) return setErrors({ amount: "Pick a token." });

      addAsset({
        id: `df-${Date.now()}`,
        class: "defi",
        symbol: entry.symbol,
        label: entry.label,
        amount: parsed!,
        coingeckoId: entry.coingeckoId,
      });
      // A new token has no quote until the next fetch, and an asset that
      // reads "No price" the moment you add it looks broken.
      refreshPrices({ force: true });
    }

    reset();
    closeSheet();
  }

  return (
    <Sheet open={sheet === "add-asset"} onClose={closeSheet} title="Add an asset">
      <ChoiceRow
        label="Kind of thing"
        value={bucket}
        onChange={setBucket}
        options={[
          { value: "tradfi", label: "Bank or brokerage" },
          { value: "defi", label: "Token" },
        ]}
      />

      {bucket === "tradfi" ? (
        <>
          <Field
            label="Account name"
            value={label}
            onChangeText={setLabel}
            placeholder="Chase Checking"
            error={errors.label}
          />
          <Field
            label="Institution"
            value={institution}
            onChangeText={setInstitution}
            placeholder="Chase"
          />
          <ChoiceRow label="Type" value={kind} onChange={setKind} options={KINDS} />
          <Field
            label={kind === "credit" ? "Balance owed" : "Balance"}
            value={balance}
            onChangeText={setBalance}
            placeholder="4500"
            keyboardType="decimal-pad"
            prefix="$"
            error={errors.balance}
          />
          <Txt variant="caption" tone="textMuted">
            Stated balances are taken at face value and never marked to market.
          </Txt>
        </>
      ) : (
        <>
          <ChoiceRow
            label="Token"
            value={token}
            onChange={setToken}
            options={TOKEN_CATALOG.map((entry) => ({
              value: entry.coingeckoId,
              label: entry.symbol,
            }))}
          />
          <Field
            label="How many you hold"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.42"
            keyboardType="decimal-pad"
            error={errors.amount}
          />
          <Txt variant="caption" tone="textMuted">
            Only the quantity is stored. The value is worked out from live prices every time.
          </Txt>
        </>
      )}

      <Divider style={{ marginVertical: space.xs }} />
      <Action label="Add to the book" variant="primary" onPress={submit} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The transfer sheet.
 *
 * It moves nothing. It writes a row to the local ledger and reduces a
 * seeded cash balance, which is the honest extent of what an app with no
 * bank connection can do, and the copy says exactly that.
 */
export function SendSheet() {
  const { sheet, closeSheet } = useNavigation();
  const { assets, updateAsset, addTransaction } = useVesper();

  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceId, setSourceId] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const cashAccounts = useMemo(
    () => assets.filter((asset) => isTradFi(asset) && asset.kind === "cash"),
    [assets],
  );

  const source = cashAccounts.find((account) => account.id === sourceId) ?? cashAccounts[0];

  function submit() {
    const next: Record<string, string> = {};
    const parsed = parseAmount(amount);

    if (!payee.trim()) next.payee = "Who is it going to?";
    if (parsed === null || parsed === 0) next.amount = "Enter an amount above zero.";
    if (!source) next.amount = "There is no cash account to send from.";
    else if (parsed !== null && parsed > (isTradFi(source) ? source.balanceUsd : 0)) {
      next.amount = `That is more than ${source.label} holds.`;
    }

    if (Object.keys(next).length > 0) return setErrors(next);

    if (source && isTradFi(source)) {
      updateAsset(source.id, { balanceUsd: source.balanceUsd - parsed! });
    }
    addTransaction({
      id: `tx-${Date.now()}`,
      payee: payee.trim(),
      amountUsd: -parsed!,
      date: new Date().toISOString(),
      category: "transfer",
    });

    setPayee("");
    setAmount("");
    setErrors({});
    closeSheet();
  }

  return (
    <Sheet open={sheet === "send"} onClose={closeSheet} title="Record a transfer">
      <Field
        label="To"
        value={payee}
        onChangeText={setPayee}
        placeholder="Marie Dubois"
        error={errors.payee}
      />
      <Field
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        placeholder="100"
        keyboardType="decimal-pad"
        prefix="$"
        error={errors.amount}
      />

      {cashAccounts.length > 1 && (
        <ChoiceRow
          label="From"
          value={source?.id ?? ""}
          onChange={setSourceId}
          options={cashAccounts.map((account) => ({ value: account.id, label: account.label }))}
        />
      )}

      {source && isTradFi(source) && (
        <View style={styles.balanceNote}>
          <Txt variant="caption" tone="textSecondary">
            {source.label}
          </Txt>
          <Txt variant="caption" tone="text">
            {usd(source.balanceUsd)} available
          </Txt>
        </View>
      )}

      <Txt variant="caption" tone="textMuted">
        Nothing leaves your account. This writes a row to the local ledger and adjusts a seeded
        balance so you can see the dashboard react.
      </Txt>

      <Divider style={{ marginVertical: space.xs }} />
      <Action label="Record it" variant="primary" onPress={submit} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  balanceNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: 10,
    backgroundColor: color.well,
  },
});
