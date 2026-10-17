/**
 * The first-run dashboard.
 *
 * Vesper connects to nothing. There is no Plaid, no wallet signature, no
 * account. So the seed is not placeholder content waiting to be replaced,
 * it *is* the product for anyone who opens the link, and it is written to
 * look like a real book of accounts rather than a demo: a current account
 * with an awkward balance, a credit card carrying something, a retirement
 * account that dwarfs everything else, and four tokens in sizes a person
 * would actually hold.
 *
 * The cost bases are set so the book shows a mixed result rather than a
 * uniformly green one. A demo portfolio where every position is up is a
 * tell that nobody thought about it.
 */

import type { Asset, Profile, QuoteMap, Transaction } from "../types";

export const seedAssets: Asset[] = [
  {
    id: "tf-chase-checking",
    class: "tradfi",
    kind: "cash",
    institution: "Chase",
    label: "Chase Checking",
    balanceUsd: 4500,
    mask: "3377",
  },
  {
    id: "tf-ally-savings",
    class: "tradfi",
    kind: "cash",
    institution: "Ally",
    label: "Ally Online Savings",
    balanceUsd: 18420.65,
    mask: "9041",
  },
  {
    id: "tf-vanguard-index",
    class: "tradfi",
    kind: "brokerage",
    institution: "Vanguard",
    label: "Vanguard Total Market",
    balanceUsd: 12000,
    costBasisUsd: 9400,
  },
  {
    id: "tf-fidelity-401k",
    class: "tradfi",
    kind: "retirement",
    institution: "Fidelity",
    label: "Fidelity 401(k)",
    balanceUsd: 63250.18,
    costBasisUsd: 51800,
  },
  {
    id: "tf-sapphire",
    class: "tradfi",
    kind: "credit",
    institution: "Chase",
    label: "Sapphire Reserve",
    balanceUsd: 2310.44,
    mask: "4812",
  },
  {
    id: "df-btc",
    class: "defi",
    symbol: "BTC",
    label: "Bitcoin",
    amount: 0.42,
    coingeckoId: "bitcoin",
    costBasisUsd: 24180,
  },
  {
    id: "df-eth",
    class: "defi",
    symbol: "ETH",
    label: "Ethereum",
    amount: 3.15,
    coingeckoId: "ethereum",
    costBasisUsd: 8260,
  },
  {
    id: "df-sol",
    class: "defi",
    symbol: "SOL",
    label: "Solana",
    amount: 48.2,
    coingeckoId: "solana",
    costBasisUsd: 3900,
  },
  {
    id: "df-link",
    class: "defi",
    symbol: "LINK",
    label: "Chainlink",
    amount: 320,
    coingeckoId: "chainlink",
    costBasisUsd: 4480,
  },
];

/**
 * Prices used when CoinGecko is unreachable and nothing is cached.
 *
 * These are plausible, not current, and the UI says so: any screen showing
 * them renders the price source as "indicative" rather than letting a stale
 * number pass as a live one.
 */
export const fallbackQuotes: QuoteMap = {
  bitcoin: { usd: 92882.4, change24h: 2.47 },
  ethereum: { usd: 3967.23, change24h: 1.78 },
  solana: { usd: 182.64, change24h: -3.99 },
  chainlink: { usd: 18.21, change24h: 0.62 },
};

/** Recent movement, for the Home and Analytics tabs. Mock, and labelled as such. */
export const seedTransactions: Transaction[] = [
  { id: "tx-1", payee: "Payroll", amountUsd: 4820, date: "2026-10-15T09:02:00Z", category: "income" },
  { id: "tx-2", payee: "Bolt Food", amountUsd: -26.81, date: "2026-10-15T12:15:00Z", category: "food" },
  { id: "tx-3", payee: "Marie Dubois", amountUsd: -100, date: "2026-10-14T16:24:00Z", category: "transfer" },
  { id: "tx-4", payee: "Uber", amountUsd: -19.46, date: "2026-10-14T18:42:00Z", category: "transport" },
  { id: "tx-5", payee: "Spotify", amountUsd: -11.99, date: "2026-10-13T06:00:00Z", category: "subscription" },
  { id: "tx-6", payee: "Whole Foods", amountUsd: -142.37, date: "2026-10-12T19:08:00Z", category: "food" },
  { id: "tx-7", payee: "Coinbase", amountUsd: -500, date: "2026-10-11T11:30:00Z", category: "transfer" },
  { id: "tx-8", payee: "Uniqlo", amountUsd: -88.5, date: "2026-10-10T14:55:00Z", category: "shopping" },
  { id: "tx-9", payee: "Con Edison", amountUsd: -96.12, date: "2026-10-09T08:00:00Z", category: "subscription" },
  { id: "tx-10", payee: "Dividend · VTSAX", amountUsd: 61.44, date: "2026-10-08T13:00:00Z", category: "income" },
];

/** Who the seeded book belongs to, until someone changes it. */
export const SEED_PROFILE: Profile = {
  name: "Leonard Lopez",
  handle: "@leonardlopez",
  plan: "Standard",
};
