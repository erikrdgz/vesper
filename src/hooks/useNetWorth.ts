/**
 * React bindings for the net-worth aggregation.
 *
 * The arithmetic lives in `src/lib/netWorth.ts`, free of React, so it can
 * be tested without a renderer. This file is only memoisation.
 */

import { useMemo } from "react";
import { computeNetWorth } from "../lib/netWorth";
import { isDeFi, type NetWorth, type ValuedAsset } from "../types";
import { useVesper } from "./useVesper";

export { computeNetWorth };

/** The aggregate for the current book of accounts and the current quotes. */
export function useNetWorth(): NetWorth {
  const { assets, prices } = useVesper();
  return useMemo(() => computeNetWorth(assets, prices.quotes), [assets, prices.quotes]);
}

/** Just the DeFi rows, valued, for the Crypto tab. */
export function useCryptoHoldings(): ValuedAsset[] {
  const netWorth = useNetWorth();
  return useMemo(() => netWorth.valued.filter((entry) => isDeFi(entry.asset)), [netWorth.valued]);
}
