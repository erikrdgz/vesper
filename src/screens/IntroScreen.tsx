/**
 * The way in.
 *
 * The two strokes of the mark fall in and converge on the vertex, the
 * name sets itself a letter at a time, a rule draws under it, and then
 * the way in appears. The motion is the shape's own: a V already reads
 * as two things meeting, so the entrance is that meeting rather than a
 * spin or a fade borrowed from somewhere else.
 *
 * It waits for a click rather than timing out. A splash that dismisses
 * itself is an obstacle; one that waits is a door.
 */

import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { useVesper } from "../hooks/useVesper";
import { color, duration, ease, nativeDriver, radius, space, type } from "../theme";
import { VesperStroke } from "../components/brand";
import { Txt } from "../components/primitives";

const LETTERS = "VESPER".split("");
const MARK = 148;

/** When each beat starts, in ms. */
const CUE = {
  left: 0,
  right: 140,
  letters: 700,
  rule: 1280,
  tagline: 1460,
  enter: 1700,
};

export function IntroScreen({ onEnter }: { onEnter: () => void }) {
  const { reduceMotion } = useVesper();
  const [leaving, setLeaving] = useState(false);

  // One value per beat, so the sequence reads as a list rather than a
  // chain of callbacks.
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const letters = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const rule = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      [left, right, rule, tagline, enter, ...letters].forEach((v) => v.setValue(1));
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
      // The dramatic curve, used on exactly the two elements that earn
      // it: a long hold, a decisive fall, a long settle.
      Animated.timing(left, {
        toValue: 1,
        duration: duration.rise * 1.5,
        easing: ease.dramatic,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(right, {
        toValue: 1,
        delay: CUE.right,
        duration: duration.rise * 1.5,
        easing: ease.dramatic,
        useNativeDriver: nativeDriver,
      }),
      ...letters.map((value, index) => beat(value, CUE.letters + index * 70, duration.medium)),
      beat(rule, CUE.rule, duration.rise),
      beat(tagline, CUE.tagline),
      beat(enter, CUE.enter),
    ]);

    animation.start();
    return () => animation.stop();
  }, [reduceMotion, left, right, letters, rule, tagline, enter]);

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

  /** Each stroke falls from above and slides in from its own side. */
  const strokeStyle = (value: Animated.Value, fromX: number) => ({
    opacity: value,
    transform: [
      { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] }) },
      { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) },
    ],
  });

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
          {
            opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
            ],
          },
        ]}
      >
        <View style={styles.mark}>
          <Animated.View style={[styles.stroke, strokeStyle(left, -22)]}>
            <VesperStroke side="left" size={MARK} />
          </Animated.View>
          <Animated.View style={[styles.stroke, strokeStyle(right, 22)]}>
            <VesperStroke side="right" size={MARK} />
          </Animated.View>
        </View>

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

        <Animated.View style={[styles.rule, { transform: [{ scaleX: rule }] }]} />

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
  },
  mark: {
    width: MARK,
    height: MARK,
  },
  stroke: {
    // Stacked: the two strokes share the vertex, so they have to sit in
    // exactly the same box or the join opens up mid-animation.
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  word: {
    flexDirection: "row",
    marginTop: space.lg,
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
    marginVertical: space.md,
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
