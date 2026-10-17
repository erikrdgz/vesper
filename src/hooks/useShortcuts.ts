/**
 * Keyboard shortcuts.
 *
 * An instrument you drive with the mouse is a dashboard; one you can
 * drive from the keys is a tool. Single letters, no modifiers, which is
 * what every terminal-shaped app does — and which is only safe because
 * of the guard below.
 *
 * Web only, by construction: it attaches to `document`, which does not
 * exist elsewhere, and a phone has no keyboard to listen to.
 */

import { useEffect } from "react";
import { Platform } from "react-native";

import { useNavigation } from "./useNavigation";
import type { TabId } from "../types";

const TAB_KEYS: Record<string, TabId> = {
  o: "home",
  a: "analytics",
  c: "crypto",
  w: "watch",
  e: "exchange",
  y: "wallet",
};

/** Shown in the help sheet, so the list and the bindings cannot drift. */
export const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: "O", does: "Overview" },
  { keys: "A", does: "Analytics" },
  { keys: "C", does: "Crypto" },
  { keys: "W", does: "Watch" },
  { keys: "E", does: "Exchange" },
  { keys: "Y", does: "Wallet" },
  { keys: "N", does: "Add an asset" },
  { keys: "/", does: "This list" },
  { keys: "Esc", does: "Close whatever is open" },
];

export function useShortcuts(): void {
  const { setTab, openSheet, closeSheet, closeAsset, closePosition } = useNavigation();

  useEffect(() => {
    if (Platform.OS !== "web") return;

    function onKey(event: KeyboardEvent) {
      // Never steal a key from something being typed into. Without this
      // guard, naming an account "Watch" would navigate six times.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      // Modifiers belong to the browser and the OS, not to us.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        closeSheet();
        closePosition();
        closeAsset();
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "/") {
        event.preventDefault();
        openSheet("shortcuts");
        return;
      }

      if (key === "n") {
        event.preventDefault();
        openSheet("add-asset");
        return;
      }

      const tab = TAB_KEYS[key];
      if (tab) {
        event.preventDefault();
        setTab(tab);
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setTab, openSheet, closeSheet, closeAsset, closePosition]);
}
