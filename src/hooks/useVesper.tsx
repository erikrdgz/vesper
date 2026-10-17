/**
 * The one store.
 *
 * Vesper is small enough that a context and a reducer beat a state library,
 * and keeping it in one file means the whole data lifecycle — hydrate,
 * fetch, persist — is readable top to bottom rather than scattered across
 * slices.
 *
 * The price fallback chain is the part worth reading: live, then the last
 * good cached set, then seeded indicative prices. The dashboard is never
 * empty and never silently wrong, because `prices.source` travels with the
 * numbers and the UI prints it.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { AccessibilityInfo } from "react-native";

import { AUTO_REFRESH_MS, MIN_REFRESH_MS, PriceError, fetchQuotes } from "../data/prices";
import { TOKEN_CATALOG, seedWatchlist } from "../data/catalog";
import { SEED_PROFILE } from "../data/seed";
import { fallbackQuotes, seedAssets, seedTransactions } from "../data/seed";
import { clearState, loadState, saveState } from "../data/storage";
import { applySwap, quoteSwap, realisedOn, type SwapError } from "../lib/exchange";
import { computeNetWorth } from "../lib/netWorth";
import { profileForName } from "../lib/profile";
import { recordSnapshot } from "../lib/snapshots";
import {
  isDeFi,
  type ActivityEntry,
  type Asset,
  type PriceAlert,
  type PriceState,
  type Profile,
  type QuoteMap,
  type Snapshot,
  type Transaction,
} from "../types";

/** The restorable slice of the book. See `captureBook`. */
export interface UndoableBook {
  assets: Asset[];
  transactions: Transaction[];
  watchlist: string[];
  activity: ActivityEntry[];
  realisedUsd: number;
}

interface State {
  /** Session-only: never restored from local storage. */
  entryStage: "intro" | "setup" | "app";
  hydrated: boolean;
  assets: Asset[];
  transactions: Transaction[];
  /** CoinGecko ids being followed, held or not. */
  watchlist: string[];
  alerts: PriceAlert[];
  activity: ActivityEntry[];
  profile: Profile;
  /** Gain already taken, cumulative, from every swap so far. */
  realisedUsd: number;
  /** One recorded net worth per day, oldest first. */
  snapshots: Snapshot[];
  /** Whether the welcome has been through once. */
  onboarded: boolean;
  /**
   * When they were last here, read once at hydration and then frozen.
   *
   * Frozen deliberately: the stored value is overwritten with "now" as
   * soon as the app loads, so anything reading it live would see the
   * current visit and report nothing. This is the value from before.
   */
  lastSeenAt: number | null;
  prices: PriceState;
  /** null means "follow the OS". */
  reduceMotionOverride: boolean | null;
  systemReduceMotion: boolean;
}

type Action =
  | {
      type: "hydrated";
      assets: Asset[];
      transactions: Transaction[];
      watchlist: string[];
      alerts: PriceAlert[];
      activity: ActivityEntry[];
      profile: Profile;
      realisedUsd: number;
      snapshots: Snapshot[];
      onboarded: boolean;
      lastSeenAt: number | null;
      quotes: QuoteMap | null;
      fetchedAt: number | null;
      reduceMotion: boolean | null;
    }
  | { type: "prices/loading" }
  | { type: "prices/ok"; quotes: QuoteMap; fetchedAt: number }
  | { type: "prices/failed"; message: string }
  | { type: "asset/add"; asset: Asset }
  | { type: "asset/update"; id: string; patch: Partial<Asset> }
  | { type: "asset/remove"; id: string }
  | { type: "transaction/add"; transaction: Transaction }
  | { type: "watch/toggle"; coingeckoId: string }
  | { type: "assets/replace"; assets: Asset[] }
  | { type: "realised/add"; amountUsd: number }
  | { type: "profile/set"; patch: Partial<Profile> }
  | { type: "snapshot/record"; snapshots: Snapshot[] }
  | { type: "book/restore"; book: UndoableBook }
  | { type: "session/enter" }
  | { type: "session/skip" }
  | { type: "session/logout" }
  | { type: "onboard/finish"; name: string; startEmpty: boolean }
  | { type: "alert/add"; alert: PriceAlert }
  | { type: "alert/remove"; id: string }
  | { type: "alert/trigger"; id: string; at: number }
  | { type: "activity/log"; entry: ActivityEntry }
  | { type: "reduceMotion/set"; value: boolean | null }
  | { type: "systemReduceMotion"; value: boolean }
  | { type: "reset" };

const initialState: State = {
  entryStage: "intro",
  hydrated: false,
  assets: seedAssets,
  transactions: seedTransactions,
  watchlist: seedWatchlist,
  alerts: [],
  activity: [],
  profile: SEED_PROFILE,
  realisedUsd: 0,
  snapshots: [],
  onboarded: false,
  lastSeenAt: null,
  prices: {
    quotes: fallbackQuotes,
    source: "fallback",
    fetchedAt: null,
    loading: false,
    error: null,
  },
  reduceMotionOverride: null,
  systemReduceMotion: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrated": {
      const hasCache = action.quotes !== null && Object.keys(action.quotes).length > 0;
      return {
        ...state,
        hydrated: true,
        assets: action.assets,
        transactions: action.transactions,
        watchlist: action.watchlist,
        alerts: action.alerts,
        activity: action.activity,
        profile: action.profile,
        realisedUsd: action.realisedUsd,
        snapshots: action.snapshots,
        onboarded: action.onboarded,
        lastSeenAt: action.lastSeenAt,
        reduceMotionOverride: action.reduceMotion,
        prices: hasCache
          ? {
              // Merge over the fallback so a token added since the last
              // fetch still has an indicative price rather than none.
              quotes: { ...fallbackQuotes, ...(action.quotes as QuoteMap) },
              source: "cached",
              fetchedAt: action.fetchedAt,
              loading: false,
              error: null,
            }
          : state.prices,
      };
    }

    case "prices/loading":
      return { ...state, prices: { ...state.prices, loading: true, error: null } };

    case "prices/ok":
      return {
        ...state,
        prices: {
          quotes: { ...state.prices.quotes, ...action.quotes },
          source: "live",
          fetchedAt: action.fetchedAt,
          loading: false,
          error: null,
        },
      };

    case "prices/failed":
      // Keep whatever numbers are already on screen: a failed refresh
      // must never blank a balance someone is mid-way through reading.
      //
      // But stop calling them live. They were live when they arrived and
      // we can no longer confirm they still are, which is what "cached"
      // means — leaving the badge green next to "rate limited" was the
      // app contradicting itself in two adjacent lines.
      return {
        ...state,
        prices: {
          ...state.prices,
          loading: false,
          error: action.message,
          source: state.prices.source === "live" ? "cached" : state.prices.source,
        },
      };

    case "asset/add":
      return { ...state, assets: [...state.assets, action.asset] };

    case "asset/update":
      return {
        ...state,
        assets: state.assets.map((asset) =>
          asset.id === action.id ? ({ ...asset, ...action.patch } as Asset) : asset,
        ),
      };

    case "asset/remove":
      return { ...state, assets: state.assets.filter((asset) => asset.id !== action.id) };

    case "transaction/add":
      return { ...state, transactions: [action.transaction, ...state.transactions] };

    case "assets/replace":
      return { ...state, assets: action.assets };

    case "realised/add":
      return { ...state, realisedUsd: state.realisedUsd + action.amountUsd };

    case "profile/set":
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case "snapshot/record":
      return { ...state, snapshots: action.snapshots };

    case "book/restore":
      return { ...state, ...action.book };

    case "session/enter":
      return state.hydrated
        ? { ...state, entryStage: state.onboarded ? "app" : "setup" }
        : state;

    case "session/skip":
      return state.hydrated
        ? { ...state, entryStage: "app", onboarded: true }
        : state;

    case "session/logout":
      return { ...state, entryStage: "intro" };

    case "onboard/finish": {
      if (!state.hydrated) return state;
      return {
        ...state,
        onboarded: true,
        entryStage: "app",
        profile: profileForName(action.name, state.profile),
        // Starting empty clears the book but keeps the watchlist, so the
        // first screen still has live prices on it rather than being a
        // blank page with a plus button.
        ...(action.startEmpty
          ? { assets: [], transactions: [], snapshots: [], activity: [], realisedUsd: 0 }
          : null),
      };
    }

    case "alert/add":
      return { ...state, alerts: [action.alert, ...state.alerts] };

    case "alert/remove":
      return { ...state, alerts: state.alerts.filter((alert) => alert.id !== action.id) };

    case "alert/trigger":
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.id === action.id ? { ...alert, triggeredAt: action.at } : alert,
        ),
      };

    case "activity/log":
      // Capped: an unbounded log is a memory leak with a nice name, and
      // nobody scrolls past fifty entries of their own edits.
      return { ...state, activity: [action.entry, ...state.activity].slice(0, 50) };

    case "watch/toggle":
      return {
        ...state,
        watchlist: state.watchlist.includes(action.coingeckoId)
          ? state.watchlist.filter((id) => id !== action.coingeckoId)
          : [...state.watchlist, action.coingeckoId],
      };

    case "reduceMotion/set":
      return { ...state, reduceMotionOverride: action.value };

    case "systemReduceMotion":
      return { ...state, systemReduceMotion: action.value };

    case "reset":
      return { ...initialState, hydrated: true, systemReduceMotion: state.systemReduceMotion };

    default:
      return state;
  }
}

interface VesperContextValue extends State {
  /** True when motion should be suppressed, OS preference and override folded together. */
  reduceMotion: boolean;
  refreshPrices: (options?: { force?: boolean }) => void;
  addAsset: (asset: Asset) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  addTransaction: (transaction: Transaction) => void;
  toggleWatch: (coingeckoId: string) => void;
  swap: (fromId: string, toId: string, amount: number) => { ok: true } | { ok: false; error: SwapError };
  addAlert: (alert: Omit<PriceAlert, "id" | "triggeredAt">) => void;
  removeAlert: (id: string) => void;
  logActivity: (kind: ActivityEntry["kind"], summary: string) => void;
  setProfile: (patch: Partial<Profile>) => void;
  finishOnboarding: (name: string, startEmpty: boolean) => void;
  enterSession: () => void;
  skipWelcome: () => void;
  logout: () => void;
  /** Swap the whole book out, for a CSV import. */
  replaceAssets: (assets: Asset[]) => void;
  /**
   * Everything a destructive action could destroy, as one value.
   *
   * Taken before the action, held in the undo closure, and handed back
   * to `restoreBook` if the offer is accepted. Simpler than a global
   * undo stack and it cannot go stale: the snapshot and the button
   * that uses it live and die together.
   */
  captureBook: () => UndoableBook;
  restoreBook: (book: UndoableBook) => void;
  setReduceMotion: (value: boolean | null) => void;
  resetToSeed: () => Promise<void>;
}

const VesperContext = createContext<VesperContextValue | null>(null);

export function VesperProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  /** Guards the rate limit: the timestamp of the last request we actually sent. */
  const lastAttemptRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);

  /* --- hydrate ---------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    loadState().then((persisted) => {
      if (cancelled) return;
      dispatch({
        type: "hydrated",
        assets: persisted?.assets ?? seedAssets,
        alerts: persisted?.alerts ?? [],
        activity: persisted?.activity ?? [],
        profile: persisted?.profile ?? SEED_PROFILE,
        realisedUsd: persisted?.realisedUsd ?? 0,
        snapshots: persisted?.snapshots ?? [],
        onboarded: persisted?.onboarded ?? false,
        lastSeenAt: persisted?.lastSeenAt ?? null,
        transactions: persisted?.transactions ?? seedTransactions,
        watchlist: persisted?.watchlist?.length ? persisted.watchlist : seedWatchlist,
        quotes: persisted?.quotes ?? null,
        fetchedAt: persisted?.quotesFetchedAt ?? null,
        reduceMotion: persisted?.reduceMotion ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* --- persist ----------------------------------------------------- */

  useEffect(() => {
    if (!state.hydrated) return; // never write the seed over a real save
    saveState({
      version: 2,
      assets: state.assets,
      transactions: state.transactions,
      watchlist: state.watchlist,
      alerts: state.alerts,
      activity: state.activity,
      profile: state.profile,
      realisedUsd: state.realisedUsd,
      snapshots: state.snapshots,
      onboarded: state.onboarded,
      // Always written as now, so the next visit can measure the gap.
      // The in-memory value stays as it was read, which is what the
      // "since you were last here" line compares against.
      lastSeenAt: Date.now(),
      quotes: state.prices.source === "fallback" ? null : state.prices.quotes,
      quotesFetchedAt: state.prices.fetchedAt,
      reduceMotion: state.reduceMotionOverride,
    });
  }, [
    state.hydrated,
    state.assets,
    state.transactions,
    state.watchlist,
    state.alerts,
    state.activity,
    state.profile,
    state.realisedUsd,
    state.snapshots,
    state.onboarded,
    state.prices.quotes,
    state.prices.source,
    state.prices.fetchedAt,
    state.reduceMotionOverride,
  ]);

  /* --- prices ------------------------------------------------------ */

  /**
   * Every id we might need a price for — the whole catalogue.
   *
   * CoinGecko charges by request, not by id, so asking for eight costs
   * exactly what asking for four costs. Narrowing it to holdings and
   * the watchlist saved nothing and meant the Watch tab showed a dash
   * next to every token you had not followed yet, which looked broken
   * and was really just a list we had declined to ask about.
   */
  const coingeckoIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...TOKEN_CATALOG.map((entry) => entry.coingeckoId),
          ...state.assets.filter(isDeFi).map((asset) => asset.coingeckoId),
          ...state.watchlist,
        ]),
      ),
    [state.assets, state.watchlist],
  );

  const refreshPrices = useCallback(
    ({ force = false }: { force?: boolean } = {}) => {
      if (coingeckoIds.length === 0) return;

      const since = Date.now() - lastAttemptRef.current;
      if (!force && since < MIN_REFRESH_MS) return;
      // Even a forced refresh respects a short floor, so a jammed button
      // cannot walk us into a 429.
      if (force && since < 5_000) return;

      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;
      lastAttemptRef.current = Date.now();

      dispatch({ type: "prices/loading" });

      fetchQuotes(coingeckoIds, controller.signal)
        .then((quotes) => {
          if (controller.signal.aborted) return;
          dispatch({ type: "prices/ok", quotes, fetchedAt: Date.now() });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            error instanceof PriceError
              ? error.rateLimited
                ? "Rate limited by CoinGecko. Showing the last prices we got."
                : error.message
              : "Could not refresh prices.";
          dispatch({ type: "prices/failed", message });
        });
    },
    [coingeckoIds],
  );

  // First fetch once hydrated, then on a timer while the app is open.
  useEffect(() => {
    if (!state.hydrated) return;
    refreshPrices({ force: true });
    const interval = setInterval(() => refreshPrices(), AUTO_REFRESH_MS);
    return () => {
      clearInterval(interval);
      inFlightRef.current?.abort();
    };
  }, [state.hydrated, refreshPrices]);

  /* --- snapshots --------------------------------------------------- */

  /**
   * Write down what the book is worth, once a day.
   *
   * This is the only history Vesper genuinely owns. It cannot know what
   * a bank balance was last Tuesday, but it can record the whole total
   * every day someone opens it, and after a fortnight that is a real
   * line rather than one derived from crypto prices.
   *
   * `recordSnapshot` returns the same array when nothing moved, so this
   * effect cannot feed itself.
   */
  useEffect(() => {
    if (!state.hydrated) return;
    if (state.prices.source === "fallback") return; // don't record a guess

    const { totalUsd } = computeNetWorth(state.assets, state.prices.quotes);
    const next = recordSnapshot(state.snapshots, totalUsd);
    if (next !== state.snapshots) dispatch({ type: "snapshot/record", snapshots: next });
  }, [state.hydrated, state.assets, state.prices.quotes, state.prices.source, state.snapshots]);

  /* --- alerts ------------------------------------------------------ */

  /**
   * Check armed alerts whenever prices move.
   *
   * Fires once and then stays triggered. A notification is attempted but
   * never required: permission may be denied, the API may not exist on
   * this platform, and an alert that only lights up in the UI is still
   * an alert.
   */
  useEffect(() => {
    if (!state.hydrated) return;

    for (const alert of state.alerts) {
      if (alert.triggeredAt !== null) continue;
      const price = state.prices.quotes[alert.coingeckoId]?.usd;
      if (price === undefined) continue;

      const crossed =
        alert.direction === "above" ? price >= alert.priceUsd : price <= alert.priceUsd;
      if (!crossed) continue;

      dispatch({ type: "alert/trigger", id: alert.id, at: Date.now() });
      dispatch({
        type: "activity/log",
        entry: {
          id: `ac-${Date.now()}-${alert.id}`,
          at: new Date().toISOString(),
          kind: "alert",
          summary: `${alert.symbol} went ${alert.direction} $${alert.priceUsd.toLocaleString()}`,
        },
      });

      try {
        const N = (globalThis as { Notification?: typeof Notification }).Notification;
        if (N && N.permission === "granted") {
          new N(`${alert.symbol} ${alert.direction} $${alert.priceUsd.toLocaleString()}`, {
            body: `Now $${price.toLocaleString()}`,
          });
        }
      } catch {
        // No notifications here. The UI still shows it as triggered.
      }
    }
  }, [state.hydrated, state.alerts, state.prices.quotes]);

  /* --- reduced motion ---------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) dispatch({ type: "systemReduceMotion", value });
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) =>
      dispatch({ type: "systemReduceMotion", value }),
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  /* --- api --------------------------------------------------------- */

  const value = useMemo<VesperContextValue>(
    () => ({
      ...state,
      reduceMotion: state.reduceMotionOverride ?? state.systemReduceMotion,
      refreshPrices,
      addAsset: (asset) => dispatch({ type: "asset/add", asset }),
      updateAsset: (id, patch) => dispatch({ type: "asset/update", id, patch }),
      removeAsset: (id) => dispatch({ type: "asset/remove", id }),
      addTransaction: (transaction) => dispatch({ type: "transaction/add", transaction }),
      toggleWatch: (coingeckoId) => dispatch({ type: "watch/toggle", coingeckoId }),

      /**
       * Price it, apply it, log it — in that order, so a swap that
       * cannot be priced never touches the book.
       */
      swap: (fromId, toId, amount) => {
        const priced = quoteSwap(state.assets, fromId, toId, amount, state.prices.quotes);
        if (!priced.ok) return priced;

        const from = state.assets.find((asset) => asset.id === fromId);
        const to = state.assets.find((asset) => asset.id === toId);

        // Book the realised gain before the position is rewritten: once
        // the basis has moved, the figure cannot be recovered.
        const realised = from && isDeFi(from) ? realisedOn(from, amount, priced.quote) : null;
        if (realised !== null) dispatch({ type: "realised/add", amountUsd: realised });

        dispatch({
          type: "assets/replace",
          assets: applySwap(state.assets, fromId, toId, amount, priced.quote),
        });
        dispatch({
          type: "activity/log",
          entry: {
            id: `ac-${Date.now()}`,
            at: new Date().toISOString(),
            kind: "swap",
            summary:
              `Swapped ${amount} ${from && isDeFi(from) ? from.symbol : "?"} for ` +
              `${priced.quote.toAmount.toFixed(4)} ${to && isDeFi(to) ? to.symbol : "?"}` +
              (realised === null
                ? ""
                : ` · realised ${realised >= 0 ? "+" : "−"}$${Math.abs(realised).toFixed(2)}`),
          },
        });
        return { ok: true };
      },

      addAlert: (alert) =>
        dispatch({
          type: "alert/add",
          alert: { ...alert, id: `al-${Date.now()}`, triggeredAt: null },
        }),
      removeAlert: (id) => dispatch({ type: "alert/remove", id }),
      enterSession: () => dispatch({ type: "session/enter" }),
      skipWelcome: () => dispatch({ type: "session/skip" }),
      logout: () => dispatch({ type: "session/logout" }),
      setProfile: (patch) => dispatch({ type: "profile/set", patch }),
      finishOnboarding: (name, startEmpty) =>
        dispatch({ type: "onboard/finish", name, startEmpty }),
      replaceAssets: (next) => dispatch({ type: "assets/replace", assets: next }),
      captureBook: () => ({
        assets: state.assets,
        transactions: state.transactions,
        watchlist: state.watchlist,
        activity: state.activity,
        realisedUsd: state.realisedUsd,
      }),
      restoreBook: (book) => dispatch({ type: "book/restore", book }),
      logActivity: (kind, summary) =>
        dispatch({
          type: "activity/log",
          entry: { id: `ac-${Date.now()}`, at: new Date().toISOString(), kind, summary },
        }),
      setReduceMotion: (v) => dispatch({ type: "reduceMotion/set", value: v }),
      resetToSeed: async () => {
        await clearState();
        dispatch({ type: "reset" });
      },
    }),
    [state, refreshPrices],
  );

  return <VesperContext.Provider value={value}>{children}</VesperContext.Provider>;
}

export function useVesper(): VesperContextValue {
  const context = useContext(VesperContext);
  if (!context) throw new Error("useVesper must be used inside <VesperProvider>");
  return context;
}
