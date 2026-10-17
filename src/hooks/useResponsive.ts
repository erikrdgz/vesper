/**
 * The responsive contract, resolved once per render.
 *
 * `useWindowDimensions` is React Native's own hook and it works unchanged
 * on web, which is the whole reason the layout can be written once. Every
 * component asks this hook rather than reading dimensions itself, so there
 * is exactly one place where "desktop" is defined.
 */

import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { layout, space } from "../theme";

export interface Responsive {
  width: number;
  height: number;
  /** Above the breakpoint: two columns, left rail, no bottom bar. */
  isDesktop: boolean;
  /** Page padding for the current size. */
  gutter: number;
  /** Width of the content well, capped at `layout.maxWidth`. */
  contentWidth: number;
  /** Resolved pixel width of the 65% column. Equals `contentWidth` on mobile. */
  primaryWidth: number;
  /** Resolved pixel width of the 35% column. Zero on mobile. */
  secondaryWidth: number;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isDesktop = width > layout.breakpoint;
    const gutter = isDesktop ? layout.gutter.desktop : layout.gutter.mobile;

    // On desktop the rail is outside the content well, so it comes off the
    // available width before the well is capped.
    const available = isDesktop ? width - layout.railWidth - gutter * 2 : width - gutter * 2;
    const contentWidth = Math.max(0, Math.min(available, layout.maxWidth));

    if (!isDesktop) {
      return {
        width,
        height,
        isDesktop,
        gutter,
        contentWidth,
        primaryWidth: contentWidth,
        secondaryWidth: 0,
      };
    }

    const usable = contentWidth - layout.columnGap;
    return {
      width,
      height,
      isDesktop,
      gutter,
      contentWidth,
      primaryWidth: Math.round(usable * layout.primaryColumn),
      secondaryWidth: Math.round(usable * layout.secondaryColumn),
    };
  }, [width, height]);
}

/** Vertical rhythm between stacked cards, which is tighter on mobile. */
export function useStackGap(): number {
  const { isDesktop } = useResponsive();
  return isDesktop ? space.xl : space.md;
}
