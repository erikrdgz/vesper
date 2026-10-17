/**
 * Moving between screens.
 *
 * Tabs used to swap instantly, which is fast and tells you nothing. A
 * short rise and fade gives the change a direction, so arriving on
 * Analytics reads as having gone somewhere rather than as the page
 * having been replaced underneath you.
 *
 * Deliberately brief — a quarter of the reveal duration used elsewhere.
 * Navigation is something people do repeatedly and impatiently, and a
 * transition you notice twice is a transition you resent the tenth time.
 */

import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";

import { useVesper } from "../hooks/useVesper";
import { duration, ease, nativeDriver } from "../theme";

export function ScreenTransition({
  screenKey,
  children,
}: {
  /** Changes whenever the content should be treated as a new screen. */
  screenKey: string;
  children: React.ReactNode;
}) {
  const { reduceMotion } = useVesper();
  const progress = useRef(new Animated.Value(1)).current;

  /**
   * The children currently on screen.
   *
   * Held in state so the outgoing screen stays mounted for the length of
   * the fade. Swapping immediately and animating the new one in would
   * flash the background between them.
   */
  const [shown, setShown] = useState({ key: screenKey, children });
  const pending = useRef(children);
  pending.current = children;

  useEffect(() => {
    if (screenKey === shown.key) {
      // Same screen, new content: adopt it without animating, or every
      // price tick would re-run the transition.
      setShown((current) => ({ ...current, children: pending.current }));
      return;
    }

    if (reduceMotion) {
      setShown({ key: screenKey, children: pending.current });
      progress.setValue(1);
      return;
    }

    const out = Animated.timing(progress, {
      toValue: 0,
      duration: duration.micro * 0.6,
      easing: ease.exit,
      useNativeDriver: nativeDriver,
    });

    out.start(({ finished }) => {
      if (!finished) return;
      setShown({ key: screenKey, children: pending.current });
      Animated.timing(progress, {
        toValue: 1,
        duration: duration.short,
        easing: ease.entrance,
        useNativeDriver: nativeDriver,
      }).start();
    });

    return () => out.stop();
    // `children` is deliberately absent: this effect is about the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey, reduceMotion, progress]);

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      {shown.children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
