/**
 * The two sheets behind the add button.
 *
 * Adding an asset is the one place someone can change what the dashboard
 * is worth, so the validation here is stricter than the rest of the app:
 * a balance that fails to parse silently becomes NaN, and NaN propagates
 * through every total on every screen before anyone notices.
 */

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useNavigation } from "../hooks/useNavigation";
import { SHORTCUTS } from "../hooks/useShortcuts";
import { useNetWorth } from "../hooks/useNetWorth";
import { useVesper } from "../hooks/useVesper";
import { tokenAmount, usd, usdSigned } from "../lib/format";
import { SWAP_FEE_BPS, SWAP_MESSAGE, quoteSwap } from "../lib/exchange";
import { TOKEN_CATALOG, catalogById, type CatalogEntry } from "../data/catalog";
import { color, space } from "../theme";
import { isDeFi, isTradFi, type Asset, type TradFiKind } from "../types";
import { ChoiceRow, Field } from "./Field";
import { CoinMark } from "./coins";
import { ChevronRightIcon } from "./icons";
import { Action, Divider, Txt } from "./primitives";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

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
  const { toast } = useToast();

  const [bucket, setBucket] = useState<"tradfi" | "defi">("tradfi");
  const [institution, setInstitution] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<TradFiKind>("cash");
  const [balance, setBalance] = useState("");
  const [token, setToken] = useState<string>("bitcoin");
  const [amount, setAmount] = useState("");
  const [cost, setCost] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setInstitution("");
    setLabel("");
    setBalance("");
    setAmount("");
    setCost("");
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
        // Only meaningful for things you invested in. Left undefined
        // rather than zero, so an untracked account stays out of the
        // return instead of dragging it down.
        ...(kind === "brokerage" || kind === "retirement"
          ? { costBasisUsd: parseAmount(cost) ?? undefined }
          : null),
      };
      addAsset(asset);
      toast(`${asset.label} added`, `${usd(parsed!)} ${kind === "credit" ? "owed" : "in"}`, "positive");
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
        costBasisUsd: parseAmount(cost) ?? undefined,
      });
      // A new token has no quote until the next fetch, and an asset that
      // reads "No price" the moment you add it looks broken.
      refreshPrices({ force: true });
      toast(`${entry.label} added`, `${tokenAmount(parsed!, entry.symbol)} now in your book`, "positive");
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
          {(kind === "brokerage" || kind === "retirement") && (
            <Field
              label="Total paid in (optional)"
              value={cost}
              onChangeText={setCost}
              placeholder="9400"
              keyboardType="decimal-pad"
              prefix="$"
            />
          )}
          <Txt variant="caption" tone="textMuted">
            Stated balances are taken at face value and never marked to market. Without a figure
            for what went in, the account is left out of your return rather than counted as free.
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
          <Field
            label="Total paid (optional)"
            value={cost}
            onChangeText={setCost}
            placeholder="24180"
            keyboardType="decimal-pad"
            prefix="$"
          />
          <Txt variant="caption" tone="textMuted">
            Only the quantity and what you paid are stored. The value is worked out from live
            prices every time. Without a cost, the position is left out of your return rather
            than counted as free.
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
  const { toast } = useToast();

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

    toast("Transfer recorded", `${usd(parsed!)} to ${payee.trim()}`);
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
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  preview: {
    gap: space.xs,
    padding: space.sm,
    borderRadius: 10,
    backgroundColor: color.well,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  shortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  key: {
    minWidth: 38,
    alignItems: "center",
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: 6,
    backgroundColor: color.well,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
  },
  positionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
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

/* ------------------------------------------------------------------ */

/**
 * What the add button opens.
 *
 * It used to go straight to add-asset. With four things you can do, a
 * chooser is one more tap but it stops the button lying about what it
 * does.
 */
export function ActionsSheet() {
  const { sheet, closeSheet, openSheet, setTab } = useNavigation();

  const options: {
    id: "add-asset" | "alert" | "send" | "exchange";
    title: string;
    detail: string;
  }[] = [
    { id: "add-asset", title: "Add an asset", detail: "A bank account, a brokerage, or a token" },
    { id: "exchange", title: "Swap tokens", detail: "Convert one holding into another at live rates" },
    { id: "alert", title: "Set a price alert", detail: "Get told when a token crosses a price" },
    { id: "send", title: "Record a transfer", detail: "Log money leaving a cash account" },
  ];

  return (
    <Sheet open={sheet === "actions"} onClose={closeSheet} title="What next?">
      {options.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => {
            // Swapping earned a screen of its own; everything else is
            // still a sheet, so the chooser has to do both.
            if (option.id === "exchange") {
              closeSheet();
              setTab("exchange");
              return;
            }
            openSheet(option.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={option.title}
          style={styles.option}
        >
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{option.title}</Txt>
            <Txt variant="caption" tone="textMuted">
              {option.detail}
            </Txt>
          </View>
          <ChevronRightIcon size={16} tone={color.textMuted} />
        </Pressable>
      ))}
    </Sheet>
  );
}

/**
 * The swap.
 *
 * Priced live, previewed before it commits, and explicit that it settles
 * nothing. The preview is the point: an exchange that applies on the
 * same tap that sets the amount is how people send the wrong number.
 */
export function SwapSheet() {
  const { sheet, closeSheet } = useNavigation();
  const { assets, prices, swap } = useVesper();
  const { toast } = useToast();

  const tokens = useMemo(() => assets.filter(isDeFi), [assets]);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const from = tokens.find((t) => t.id === fromId) ?? tokens[0];
  const to = tokens.find((t) => t.id === toId) ?? tokens.find((t) => t.id !== from?.id);

  const parsed = parseAmount(amount);
  const priced =
    from && to && parsed !== null
      ? quoteSwap(assets, from.id, to.id, parsed, prices.quotes)
      : null;

  function submit() {
    if (!from || !to) return;
    if (parsed === null) return setError("Enter an amount above zero.");

    const priced = quoteSwap(assets, from.id, to.id, parsed, prices.quotes);
    const result = swap(from.id, to.id, parsed);
    if (!result.ok) return setError(SWAP_MESSAGE[result.error]);

    toast(
      "Swapped",
      priced.ok
        ? `${tokenAmount(parsed, from.symbol)} for ${tokenAmount(priced.quote.toAmount, to.symbol)}`
        : undefined,
      "positive",
    );
    setAmount("");
    setError(null);
    closeSheet();
  }

  if (tokens.length < 2) {
    return (
      <Sheet open={sheet === "swap"} onClose={closeSheet} title="Swap tokens">
        <Txt variant="body" tone="textSecondary">
          You need at least two tokens in the book to swap between them.
        </Txt>
      </Sheet>
    );
  }

  return (
    <Sheet open={sheet === "swap"} onClose={closeSheet} title="Swap tokens">
      <ChoiceRow
        label="From"
        value={from?.id ?? ""}
        onChange={(id) => {
          setFromId(id);
          if (id === to?.id) setToId(tokens.find((t) => t.id !== id)?.id ?? "");
        }}
        options={tokens.map((token) => ({ value: token.id, label: token.symbol }))}
      />

      <Field
        label={`Amount in ${from?.symbol ?? ""}`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={from ? String(Math.min(from.amount, 0.1)) : "0"}
        error={error}
      />
      {from && (
        <Txt variant="caption" tone="textMuted">
          You hold {tokenAmount(from.amount, from.symbol)}.
        </Txt>
      )}

      <ChoiceRow
        label="To"
        value={to?.id ?? ""}
        onChange={setToId}
        options={tokens
          .filter((token) => token.id !== from?.id)
          .map((token) => ({ value: token.id, label: token.symbol }))}
      />

      {priced?.ok && to && from && (
        <View style={styles.preview}>
          <PreviewRow label="Rate" value={`1 ${from.symbol} = ${priced.quote.rate.toFixed(4)} ${to.symbol}`} />
          <PreviewRow label="Value out" value={usd(priced.quote.fromUsd)} />
          <PreviewRow label={`Fee (${SWAP_FEE_BPS / 100}%)`} value={usd(priced.quote.feeUsd)} />
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

      <Txt variant="caption" tone="textMuted">
        Nothing is traded. This rewrites your local book at today's prices and moves the cost
        basis across with it, so your return stays correct afterwards.
      </Txt>

      <Divider style={{ marginVertical: space.xs }} />
      <Action label="Swap" variant="primary" onPress={submit} disabled={!priced?.ok} />
    </Sheet>
  );
}

function PreviewRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.previewRow}>
      <Txt variant="caption" tone="textSecondary">
        {label}
      </Txt>
      <Txt variant={strong ? "bodyStrong" : "mono"}>{value}</Txt>
    </View>
  );
}

/** Set a price to be told about. */
export function AlertSheet() {
  const { sheet, closeSheet } = useNavigation();
  const { assets, watchlist, prices, addAlert } = useVesper();
  const { toast } = useToast();

  // Anything held or followed is worth alerting on.
  const options = useMemo(() => {
    const ids = new Set([...assets.filter(isDeFi).map((a) => a.coingeckoId), ...watchlist]);
    return [...ids].map((id) => catalogById(id)).filter((e): e is CatalogEntry => !!e);
  }, [assets, watchlist]);

  const [coingeckoId, setCoingeckoId] = useState<string>("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const entry = options.find((o) => o.coingeckoId === coingeckoId) ?? options[0];
  const current = entry ? prices.quotes[entry.coingeckoId]?.usd : undefined;

  function submit() {
    const parsed = parseAmount(price);
    if (!entry) return;
    if (parsed === null) return setError("Enter a price above zero.");

    addAlert({
      coingeckoId: entry.coingeckoId,
      symbol: entry.symbol,
      direction,
      priceUsd: parsed,
    });
    toast("Alert armed", `${entry.symbol} ${direction} ${usd(parsed)}`);
    setPrice("");
    setError(null);
    closeSheet();
  }

  return (
    <Sheet open={sheet === "alert"} onClose={closeSheet} title="Set a price alert">
      <ChoiceRow
        label="Token"
        value={entry?.coingeckoId ?? ""}
        onChange={setCoingeckoId}
        options={options.map((o) => ({ value: o.coingeckoId, label: o.symbol }))}
      />
      <ChoiceRow
        label="When the price goes"
        value={direction}
        onChange={setDirection}
        options={[
          { value: "above" as const, label: "Above" },
          { value: "below" as const, label: "Below" },
        ]}
      />
      <Field
        label="Price"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        prefix="$"
        placeholder={current ? String(Math.round(current)) : "0"}
        error={error}
      />
      {current !== undefined && (
        <Txt variant="caption" tone="textMuted">
          {entry?.symbol} is {usd(current)} now.
        </Txt>
      )}
      <Txt variant="caption" tone="textMuted">
        Checked each time prices refresh, about every two minutes, and only while this tab is
        open. Vesper has no server to watch it for you.
      </Txt>

      <Divider style={{ marginVertical: space.xs }} />
      <Action label="Arm the alert" variant="primary" onPress={submit} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

/**
 * What a long press on a position offers.
 *
 * Swiping reveals the two destructive-ish actions because those are the
 * ones worth a deliberate gesture. Everything else lives here, where
 * there is room to name it and show what it would act on.
 */
export function PositionSheet() {
  const { positionId, closePosition, setTab, openAsset, openSheet } = useNavigation();
  const { assets, removeAsset, toggleWatch, watchlist, captureBook, restoreBook } = useVesper();
  const netWorth = useNetWorth();
  const { toast, toastUndo } = useToast();

  const asset = assets.find((candidate) => candidate.id === positionId);
  const valued = netWorth.valued.find((entry) => entry.asset.id === positionId);
  const defi = asset && isDeFi(asset) ? asset : null;
  const following = defi ? watchlist.includes(defi.coingeckoId) : false;

  if (!asset || !valued) {
    return <Sheet open={false} onClose={closePosition} title="" children={null} />;
  }

  const actions: { title: string; detail: string; onPress: () => void; danger?: boolean }[] = [];

  if (defi) {
    actions.push(
      {
        title: "Open detail",
        detail: "Charts, ranges and the full position",
        onPress: () => {
          setTab("crypto");
          openAsset(asset.id);
        },
      },
      {
        title: "Swap this",
        detail: "Convert it into another holding",
        onPress: () => setTab("exchange"),
      },
      {
        title: "Set a price alert",
        detail: `Get told when ${defi.symbol} crosses a price`,
        onPress: () => openSheet("alert"),
      },
      {
        title: following ? "Stop following" : "Follow in the bar",
        detail: following ? "Remove it from the watch bar" : "Pin it to the top of every screen",
        onPress: () => {
          toggleWatch(defi.coingeckoId);
          toast(following ? `Unfollowed ${defi.label}` : `Following ${defi.label}`);
        },
      },
    );
  }

  actions.push({
    title: "Remove from book",
    detail: "It stops counting toward your net worth",
    danger: true,
    onPress: () => {
      const before = captureBook();
      removeAsset(asset.id);
      toastUndo(`${asset.label} removed`, "It is out of your book.", () => restoreBook(before));
    },
  });

  return (
    <Sheet open={positionId !== null} onClose={closePosition} title={asset.label}>
      <View style={styles.positionHead}>
        {defi && <CoinMark symbol={defi.symbol} size={32} />}
        <View style={{ flex: 1 }}>
          <Txt variant="h2">{usd(valued.valueUsd)}</Txt>
          <Txt variant="caption" tone="textMuted">
            {defi ? tokenAmount(defi.amount, defi.symbol) : "Stated balance"}
            {valued.gainPct === null ? "" : ` · ${usdSigned(valued.gainUsd ?? 0)} since bought`}
          </Txt>
        </View>
      </View>

      <Divider />

      {actions.map((action) => (
        <Pressable
          key={action.title}
          onPress={() => {
            action.onPress();
            closePosition();
          }}
          accessibilityRole="button"
          accessibilityLabel={action.title}
          style={styles.option}
        >
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong" tone={action.danger ? "negative" : "text"}>
              {action.title}
            </Txt>
            <Txt variant="caption" tone="textMuted">
              {action.detail}
            </Txt>
          </View>
          <ChevronRightIcon size={16} tone={color.textMuted} />
        </Pressable>
      ))}
    </Sheet>
  );
}

/** The keyboard shortcut list, opened with "/". */
export function ShortcutsSheet() {
  const { sheet, closeSheet } = useNavigation();

  return (
    <Sheet open={sheet === "shortcuts"} onClose={closeSheet} title="Keyboard">
      {SHORTCUTS.map((shortcut) => (
        <View key={shortcut.keys} style={styles.shortcutRow}>
          <View style={styles.key}>
            <Txt variant="micro" tone="text">
              {shortcut.keys}
            </Txt>
          </View>
          <Txt variant="body" tone="textSecondary" style={{ flex: 1 }}>
            {shortcut.does}
          </Txt>
        </View>
      ))}
      <Txt variant="caption" tone="textMuted">
        Single letters, no modifier. They are ignored while you are typing in a field.
      </Txt>
    </Sheet>
  );
}
