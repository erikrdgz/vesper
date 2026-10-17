/**
 * The entrance.
 *
 * Opacity runs for 900ms while the travel runs for 700ms, so an element
 * stops moving before it stops fading and settles rather than arrives.
 * That mismatch is the whole trick, and it is why this is two animations
 * rather than one `Animated.timing` driving both.
 */

import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

import { useVesper } from "../hooks/useVesper";
import { duration, ease, nativeDriver, rise, staggerDelay } from "../theme";

interface RevealProps {
  children: React.ReactNode;
  /** Position in a staggered group. Delay is capped so long lists do not crawl. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

export function Reveal({ children, index = 0, style }: RevealProps) {
  const { reduceMotion } = useVesper();

  // Start at the final values when motion is reduced, so nothing animates
  // and nothing is left invisible if an effect never runs.
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : rise)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    const delay = staggerDelay(index);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration.fade,
        delay,
        easing: ease.entrance,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: duration.rise,
        delay,
        easing: ease.entrance,
        useNativeDriver: nativeDriver,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [index, opacity, translateY, reduceMotion]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
