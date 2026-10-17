/**
 * Vesper's data model.
 *
 * The whole product rests on one distinction: some things you own have a
 * value, and some things you own have a quantity. A checking account is
 * worth $4,500 because the bank says so, and it will say so again tomorrow.
 * 0.42 BTC is worth whatever the last trade says it is, and that number is
 * stale by the time it finishes rendering.
 *
 * Every dashboard that treats those two as the same kind of row eventually
 * tells someone their net worth is $0 because a price fetch failed. So they
 * are separate types here, they are stored separately, and only the
 * valuation layer is allowed to put them in the same list.
 */

/** Which half of the book an asset belongs to. */
export type AssetClass = "tradfi" | "defi";

/** The traditional-finance shapes we model. */
export type TradFiKind = "cash" | "brokerage" | "retirement" | "credit";

/**
 * An asset whose value is stated, not derived.
 *
 * `balanceUsd` is the number the institution reports. We never recompute it,
 * we never mark it to market, and we never let a failed network call change
 * it. `credit` balances are held as positive numbers and subtracted at
 * aggregation time, so the UI can show "$2,310 owed" without a minus sign
 * leaking into every label.
 */
export interface TradFiAsset {
  id: string;
  class: "tradfi";
  kind: TradFiKind;
  /** "Chase", "Vanguard" — the institution, used for grouping and initials. */
  institution: string;
  /** "Chase Checking" — what the person calls it. */
  label: string;
  /** Stated value in USD. Always positive, including for `credit`. */
  balanceUsd: number;
  /**
   * What was paid in, for accounts where that is a meaningful question.
   *
   * Brokerage and retirement accounts have one; cash and credit do not,
   * because "what did you pay for your checking balance" is nonsense.
   * Undefined means untracked, which is different from zero.
   */
  costBasisUsd?: number;
  /** Optional: last four digits, for the account-card treatment. */
  mask?: string;
}

/**
 * An asset whose value is derived from a quantity and a live price.
 *
 * `amount` is the only thing we persist. Price is never written to the
 * asset, because a price saved to disk is a lie with a timestamp.
 */
export interface DeFiAsset {
  id: string;
  class: "defi";
  /** Ticker, uppercase: "BTC". Display only. */
  symbol: string;
  /** "Bitcoin" — the full name. */
  label: string;
  /** Token quantity held. The one persisted number. */
  amount: number;
  /**
   * Total USD paid for the current `amount`.
   *
   * Held as a total rather than a per-unit average so that adding to a
   * position is a sum rather than a weighted mean recomputed from a
   * running average that drifts. Undefined means untracked.
   */
  costBasisUsd?: number;
  /** CoinGecko's id for `/simple/price`, e.g. "bitcoin". */
  coingeckoId: string;
}

export type Asset = TradFiAsset | DeFiAsset;

/** Narrowing helpers, so screens never reach for `asset.class` directly. */
export const isTradFi = (asset: Asset): asset is TradFiAsset => asset.class === "tradfi";
export const isDeFi = (asset: Asset): asset is DeFiAsset => asset.class === "defi";

/** A single live quote. */
export interface Quote {
  /** USD price per token. */
  usd: number;
  /** 24h change as a percentage, e.g. -3.99 for a 3.99% fall. */
  change24h: number;
}

/** CoinGecko id -> quote. Absent key means "we have no price for this". */
export type QuoteMap = Record<string, Quote>;

/**
 * Where the prices on screen came from.
 *
 * This is surfaced in the UI rather than hidden, because the honest answer
 * to "is this number real?" is part of the product. `cached` means the
 * network failed but we had a recent answer on disk; `fallback` means we
 * never got one and are showing seeded prices.
 */
export type PriceSource = "live" | "cached" | "fallback";

export interface PriceState {
  quotes: QuoteMap;
  source: PriceSource;
  /** Epoch ms of the quote set currently in `quotes`. */
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

/** An asset plus everything the valuation layer worked out about it. */
export interface ValuedAsset {
  asset: Asset;
  /** USD value. For credit, this is negative. */
  valueUsd: number;
  /** Share of gross assets, 0–1. Credit lines are excluded from the base. */
  weight: number;
  /** 24h change in USD. Zero for TradFi, which we do not mark to market. */
  change24hUsd: number;
  /** 24h change as a percentage. Zero for TradFi. */
  change24hPct: number;
  /** What was paid, or null where no basis is recorded. */
  costUsd: number | null;
  /** Value minus cost. Null when there is no basis to compare against. */
  gainUsd: number | null;
  /** Gain as a percentage of cost. Null when cost is absent or zero. */
  gainPct: number | null;
  /**
   * False when a DeFi asset has no quote in the current map, which happens
   * if someone adds a token by an id CoinGecko does not know. Such an asset
   * is valued at zero and the UI says "no price" rather than "$0.00".
   * Always true for TradFi, whose value is stated rather than fetched.
   */
  priced: boolean;
}

/** The aggregate the whole dashboard is built around. */
export interface NetWorth {
  /** Assets minus liabilities. The headline number. */
  totalUsd: number;
  /** Stated balances, credit excluded. */
  tradFiUsd: number;
  /** Marked to market. */
  deFiUsd: number;
  /** Credit balances owed, as a positive number. */
  liabilitiesUsd: number;
  /** Movement over 24h, which only the DeFi half can produce. */
  change24hUsd: number;
  change24hPct: number;
  /**
   * Cost and return across positions that record a basis.
   *
   * Deliberately not across the whole book: a checking account has no
   * cost, and folding it in at zero would understate the return on
   * everything that does.
   */
  costUsd: number;
  gainUsd: number;
  gainPct: number;
  /** Value of the positions the return above is calculated over. */
  trackedValueUsd: number;
  /** Every asset, valued and weighted, sorted by value descending. */
  valued: ValuedAsset[];
}

/** Money that moved. Mock data; Vesper does not connect to a bank. */
export interface Transaction {
  id: string;
  /** Merchant or counterparty. */
  payee: string;
  /** Negative for money out, positive for money in. */
  amountUsd: number;
  /** ISO 8601. */
  date: string;
  category: TransactionCategory;
}

export type TransactionCategory =
  | "food"
  | "transport"
  | "income"
  | "transfer"
  | "subscription"
  | "shopping";

/** A point on a chart. `t` is epoch ms, `v` is USD. */
export interface SeriesPoint {
  t: number;
  v: number;
}

/** The ranges the asset-detail chart offers. */
export type ChartRange = "1H" | "1D" | "1W" | "1M" | "1Y";

/** Top-level navigation. The FAB is not a tab; it opens a sheet. */
export type TabId = "home" | "analytics" | "crypto" | "watch" | "settings";

/** What the FAB and the command bar can open. */
export type SheetId = "actions" | "add-asset" | "send" | "swap" | "alert" | null;

/**
 * A price someone is waiting for.
 *
 * `triggeredAt` is what stops an alert firing on every poll once it is
 * crossed: an alert is a doorbell, not a siren.
 */
export interface PriceAlert {
  id: string;
  coingeckoId: string;
  symbol: string;
  direction: "above" | "below";
  priceUsd: number;
  triggeredAt: number | null;
}

/**
 * Something that happened in the book.
 *
 * Distinct from `Transaction`, which is money moving. This is a record
 * of edits — what was added, swapped, removed — so a portfolio that
 * changed under you has somewhere to explain itself.
 */
export interface ActivityEntry {
  id: string;
  /** ISO 8601. */
  at: string;
  kind: "swap" | "add" | "remove" | "edit" | "transfer" | "alert";
  summary: string;
}

/** Everything Vesper persists. Versioned so a schema change can migrate. */
export interface PersistedState {
  version: 2;
  assets: Asset[];
  /** Seeded, plus anything added through the send sheet. */
  transactions: Transaction[];
  /** CoinGecko ids being followed, held or not. */
  watchlist: string[];
  alerts: PriceAlert[];
  activity: ActivityEntry[];
  /** Last good quote set, for the `cached` price source. */
  quotes: QuoteMap | null;
  quotesFetchedAt: number | null;
  /** Reduced motion is read from the OS; this is the explicit override. */
  reduceMotion: boolean | null;
}
