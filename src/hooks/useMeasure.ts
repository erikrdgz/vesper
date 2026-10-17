/**
 * Measured size of a laid-out view.
 *
 * SVG needs numbers. The terminal grid is built out of flex, which does
 * not produce numbers until it has laid out, so any pane holding a chart
 * measures itself and renders the chart on the second pass. Charts render
 * nothing at all on the first pass rather than guessing a size and
 * snapping, which is more obvious than a single blank frame.
 */

import { useCallback, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

export interface Measured {
  width: number;
  height: number;
  onLayout: (event: LayoutChangeEvent) => void;
  /** True once a real size has arrived. */
  ready: boolean;
}

export function useMeasure(): Measured {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => {
      // Layout fires on every scroll frame in some RN versions. Bail on
      // sub-pixel noise or the chart re-renders continuously.
      if (Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1) {
        return previous;
      }
      return { width, height };
    });
  }, []);

  return { ...size, onLayout, ready: size.width > 0 && size.height > 0 };
}
