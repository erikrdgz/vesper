/**
 * Interaction motion.
 *
 * Everything here is spring-driven, because everything here is attached to
 * a hand. The fixed-duration curves in the theme are for reveals, where the
 * motion is choreography and choreography has a running time; a tilt that
 * follows a cursor on a 320ms timer always feels a beat behind.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, type LayoutChangeEvent } from "react-native";

import { useVesper } from "./useVesper";
import { nativeDriver, spring } from "../theme";

type SpringConfig = { tension: number; friction: number };

/**
 * An `Animated.Value` plus a setter that springs it.
 *
 * Returns the value rather than a style so the caller decides what it
 * drives — rotation, scale, translation or opacity.
 */
export function useSpringTo(
  initial: number,
  config: SpringConfig = spring.press,
): [Animated.Value, (to: number) => void] {
  const { reduceMotion } = useVesper();
  const value = useRef(new Animated.Value(initial)).current;

  const to = useCallback(
    (target: number) => {
      if (reduceMotion) {
        value.setValue(target);
        return;
      }
      Animated.spring(value, {
        toValue: target,
        ...config,
        useNativeDriver: nativeDriver,
      }).start();
    },
    // `config` is a literal at most call sites, so compare its contents
    // rather than its identity or every render restarts the spring.
    [value, reduceMotion, config.tension, config.friction],
  );

  return [value, to];
}

export interface Tilt {
  /** −1 at the left edge, 1 at the right. Springs back to 0 on leave. */
  x: Animated.Value;
  /** −1 at the top edge, 1 at the bottom. */
  y: Animated.Value;
  /** 0 when the pointer is away, 1 when it is over. */
  hover: Animated.Value;
  /** Spread onto the View that should track the pointer. */
  handlers: {
    onLayout: (event: LayoutChangeEvent) => void;
    onPointerMove: (event: PointerLike) => void;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
}

/** The bits of a pointer event we use, across RN's and the DOM's shapes. */
interface PointerLike {
  nativeEvent: {
    offsetX?: number;
    offsetY?: number;
    locationX?: number;
    locationY?: number;
  };
}

/**
 * Normalised pointer position over an element.
 *
 * Touch devices never fire these, which is correct: a tilt that follows a
 * finger would sit under the finger, and the element would spend the whole
 * gesture hidden.
 */
export function usePointerTilt(): Tilt {
  const { reduceMotion } = useVesper();
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const hover = useRef(new Animated.Value(0)).current;
  const size = useRef({ width: 0, height: 0 });

  const settle = useCallback(
    (target: Animated.Value, to: number, config: SpringConfig) => {
      if (reduceMotion) {
        target.setValue(to);
        return;
      }
      Animated.spring(target, { toValue: to, ...config, useNativeDriver: nativeDriver }).start();
    },
    [reduceMotion],
  );

  const handlers = useMemo(
    () => ({
      onLayout: (event: LayoutChangeEvent) => {
        size.current = {
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        };
      },
      onPointerMove: (event: PointerLike) => {
        if (reduceMotion) return;
        const { width, height } = size.current;
        if (width === 0 || height === 0) return;

        const px = event.nativeEvent.offsetX ?? event.nativeEvent.locationX;
        const py = event.nativeEvent.offsetY ?? event.nativeEvent.locationY;
        if (px === undefined || py === undefined) return;

        // Set directly rather than springing: the pointer is already a
        // continuous signal, and springing to each sample compounds into
        // visible lag. The spring is on the exit, where it is wanted.
        x.setValue((px / width) * 2 - 1);
        y.setValue((py / height) * 2 - 1);
      },
      onPointerEnter: () => settle(hover, 1, spring.press),
      onPointerLeave: () => {
        settle(x, 0, spring.track);
        settle(y, 0, spring.track);
        settle(hover, 0, spring.press);
      },
    }),
    [x, y, hover, settle, reduceMotion],
  );

  return { x, y, hover, handlers };
}

/**
 * Fires true briefly whenever `value` changes, for tick flashes.
 *
 * A price that updates with no acknowledgement looks static; a row that
 * flashes green or red the instant it changes is how you can tell, at a
 * glance across a room, that the feed is alive.
 */
export function useChangeFlash(value: number, durationMs = 700): "up" | "down" | null {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const previous = useRef(value);

  useEffect(() => {
    if (value === previous.current) return;
    const direction = value > previous.current ? "up" : "down";
    previous.current = value;
    setFlash(direction);

    const timer = setTimeout(() => setFlash(null), durationMs);
    return () => clearTimeout(timer);
  }, [value, durationMs]);

  return flash;
}
