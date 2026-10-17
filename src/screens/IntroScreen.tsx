/**
 * The way in.
 *
 * The prism assembles, the name sets itself a letter at a time, a rule
 * draws under it, and then the way in appears. It reuses the same 3D
 * object the Crypto tab uses rather than animating a separate splash
 * graphic, so the first thing you see is the thing you will be looking at
 * for the rest of the session.
 *
 * It waits for a click rather than timing out. A splash that dismisses
 * itself is an obstacle; one that waits is a door.
 */

import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { useVesper } from "../hooks/useVesper";
import { color, duration, ease, nativeDriver, radius, space, type } from "../theme";
import { TokenObject } from "../components/TokenObject";
import { Txt } from "../components/primitives";

const LETTERS = "VESPER".split("");

/** When each beat starts, in ms. */
const CUE = {
  prism: 0,
  letters: 320,
  rule: 980,
  tagline: 1180,
  enter: 1480,
};

export function IntroScreen({ onEnter }: { onEnter: () => void }) {
  const { reduceMotion } = useVesper();
  const [leaving, setLeaving] = useState(false);

  // One value per beat, so the sequence is legible as a list rather than
  // buried in a chain of callbacks.
  const prism = useRef(new Animated.Value(0)).current;
  const letters = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const rule = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      prism.setValue(1);
      letters.forEach((value) => value.setValue(1));
      rule.setValue(1);
      tagline.setValue(1);
      enter.setValue(1);
      return;
    }

    const beat = (value: Animated.Value, delay: number, ms: number = duration.fade) =>
      Animated.timing(value, {
        toValue: 1,
        delay,
        duration: ms,
        easing: ease.entrance,
        useNativeDriver: nativeDriver,
      });

    const animation = Animated.parallel([
      beat(prism, CUE.prism, duration.rise * 1.6),
      ...letters.map((value, index) => beat(value, CUE.letters + index * 70, duration.medium)),
      beat(rule, CUE.rule, duration.rise),
      beat(tagline, CUE.tagline),
      beat(enter, CUE.enter),
    ]);

    animation.start();
    return () => animation.stop();
  }, [reduceMotion, prism, letters, rule, tagline, enter]);

  function handleEnter() {
    if (leaving) return;
    setLeaving(true);

    if (reduceMotion) {
      onEnter();
      return;
    }

    Animated.timing(exit, {
      toValue: 1,
      duration: duration.medium,
      // Exits accelerate away. The dashboard is what matters now.
      easing: ease.exit,
      useNativeDriver: nativeDriver,
    }).start(onEnter);
  }

  const leaveOpacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const leaveScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Pressable
      style={styles.root}
      onPress={handleEnter}
      accessibilityRole="button"
      accessibilityLabel="Enter Vesper"
    >
      <Animated.View
        style={[
          styles.stage,
          { opacity: leaveOpacity, transform: [{ scale: leaveScale }] },
        ]}
      >
        <Animated.View
          style={{
            opacity: prism,
            transform: [
              { scale: prism.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
            ],
          }}
        >
          <TokenObject symbol="VESPER" flipIndex={0} height={300} distance={8.2} />
        </Animated.View>

        <View style={styles.word}>
          {LETTERS.map((letter, index) => (
            <Animated.Text
              key={index}
              style={[
                styles.letter,
                {
                  opacity: letters[index],
                  transform: [
                    {
                      translateY: letters[index]!.interpolate({
                        inputRange: [0, 1],
                        outputRange: [14, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>

        <Animated.View
          style={[
            styles.rule,
            { transform: [{ scaleX: rule }] },
          ]}
        />

        <Animated.View style={{ opacity: tagline }}>
          <Txt variant="caption" tone="textSecondary" style={styles.tagline}>
            Bank balances and crypto in one place, honest about the difference.
          </Txt>
        </Animated.View>

        <Animated.View
          style={{
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            ],
          }}
        >
          <View style={styles.enter}>
            <Txt variant="micro" tone="accentInk">
              ENTER
            </Txt>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.ground,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  stage: {
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    gap: space.sm,
  },
  word: {
    flexDirection: "row",
    marginTop: space.xs,
  },
  letter: {
    ...(type.h1 as object),
    color: color.text,
    // Wide enough that six letters read as a mark rather than a word.
    letterSpacing: 10,
    marginRight: -10,
  },
  rule: {
    width: 180,
    height: 1,
    backgroundColor: color.hairlineStrong,
    marginVertical: space.sm,
  },
  tagline: {
    textAlign: "center",
    maxWidth: 320,
  },
  enter: {
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
});
