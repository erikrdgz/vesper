/**
 * Navigation, such as it is.
 *
 * Four tabs, one detail view and two sheets. Expo Router would give real
 * URLs, but it also wants a server or a 404 rewrite per route, and this
 * ships as a single static bundle on GitHub Pages. A reducer in context is
 * the honest size of the problem.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { SheetId, TabId } from "../types";

interface NavigationValue {
  tab: TabId;
  setTab: (tab: TabId) => void;
  /** The asset whose detail view is open, or null for the tab itself. */
  detailId: string | null;
  openAsset: (id: string) => void;
  closeAsset: () => void;
  sheet: SheetId;
  openSheet: (sheet: Exclude<SheetId, null>) => void;
  closeSheet: () => void;
  /**
   * The position whose action menu is open.
   *
   * Separate from `sheet` because it carries a subject. A long press is
   * always about a particular row, and folding that into the sheet enum
   * would mean encoding the id in the enum value.
   */
  positionId: string | null;
  openPosition: (id: string) => void;
  closePosition: () => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTabState] = useState<TabId>("home");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [positionId, setPositionId] = useState<string | null>(null);

  // Switching tabs always leaves the detail view. Returning to a tab and
  // finding a sub-screen still open is the kind of state that feels broken
  // even when it is technically what you left behind.
  const setTab = useCallback((next: TabId) => {
    setTabState(next);
    setDetailId(null);
    // A row menu belongs to the screen it was opened from.
    setPositionId(null);
  }, []);

  const value = useMemo<NavigationValue>(
    () => ({
      tab,
      setTab,
      detailId,
      openAsset: setDetailId,
      closeAsset: () => setDetailId(null),
      sheet,
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
      positionId,
      openPosition: setPositionId,
      closePosition: () => setPositionId(null),
    }),
    [tab, setTab, detailId, sheet, positionId],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("useNavigation must be used inside <NavigationProvider>");
  return context;
}
