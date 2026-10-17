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
import { fallbackQuotes, seedAssets, seedTransactions } from "../data/seed";
import { clearState, loadState, saveState } from "../data/storage";
import { isDeFi, type Asset, type PriceState, type QuoteMap, type Transaction } from "../types";

interface State {
  hydrated: boolean;
  assets: Asset[];
  transactions: Transaction[];
  prices: PriceState;
  /** null means "follow the OS". */
  reduceMotionOverride: boolean | null;
  systemReduceMotion: boolean;
}

type Action =
  | { type: "hydrated"; assets: Asset[]; transactions: Transaction[]; quotes: QuoteMap | null; fetchedAt: number | null; reduceMotion: boolean | null }
  | { type: "prices/loading" }
  | { type: "prices/ok"; quotes: QuoteMap; fetchedAt: number }
  | { type: "prices/failed"; message: string }
  | { type: "asset/add"; asset: Asset }
  | { type: "asset/update"; id: string; patch: Partial<Asset> }
  | { type: "asset/remove"; id: string }
  | { type: "transaction/add"; transaction: Transaction }
  | { type: "reduceMotion/set"; value: boolean | null }
  | { type: "systemReduceMotion"; value: boolean }
  | { type: "reset" };

const initialState: State = {
  hydrated: false,
  assets: seedAssets,
  transactions: seedTransactions,
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
      // Keep whatever numbers are already on screen. A failed refresh must
      // never blank a balance someone is mid-way through reading.
      return { ...state, prices: { ...state.prices, loading: false, error: action.message } };

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
        transactions: persisted?.transactions ?? seedTransactions,
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
      version: 1,
      assets: state.assets,
      transactions: state.transactions,
      quotes: state.prices.source === "fallback" ? null : state.prices.quotes,
      quotesFetchedAt: state.prices.fetchedAt,
      reduceMotion: state.reduceMotionOverride,
    });
  }, [
    state.hydrated,
    state.assets,
    state.transactions,
    state.prices.quotes,
    state.prices.source,
    state.prices.fetchedAt,
    state.reduceMotionOverride,
  ]);

  /* --- prices ------------------------------------------------------ */

  const coingeckoIds = useMemo(
    () => state.assets.filter(isDeFi).map((asset) => asset.coingeckoId),
    [state.assets],
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
