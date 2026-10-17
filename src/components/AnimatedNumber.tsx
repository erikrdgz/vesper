/**
 * A balance that rolls.
 *
 * Each digit is its own column of 0–9 that springs to the right offset, so
 * changing 146,691 to 146,703 moves only the three digits that changed and
 * leaves the rest still. Cross-fading the whole string would be one line of
 * code and would read as a number being replaced; this reads as a number
 * counting, which is the difference between a dashboard and an instrument.
 *
 * Non-digit characters — the currency symbol, separators, the decimal
 * point — are rendered flat and never animate.
 */

import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View, type TextStyle } from "react-native";

import { useVesper } from "../hooks/useVesper";
import { color, nativeDriver, spring, type } from "../theme";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

interface AnimatedNumberProps {
  /** The already-formatted string, e.g. "$146,691.34". */
  value: string;
  variant?: keyof typeof type;
  tone?: string;
  /** Overrides for the minor part, so cents can sit smaller and dimmer. */
  minorVariant?: keyof typeof type;
  minorTone?: string;
  /** Index at which the minor part begins, usually the decimal point. */
  minorFrom?: number;
}

export function AnimatedNumber({
  value,
  variant = "displayXl",
  tone = color.text,
  minorVariant,
  minorTone,
  minorFrom,
}: AnimatedNumberProps) {
  const characters = useMemo(() => value.split(""), [value]);

  return (
    <View style={styles.row} accessibilityLabel={value} accessibilityRole="text">
      {characters.map((character, index) => {
        const minor = minorFrom !== undefined && index >= minorFrom;
        const style = minor ? (minorVariant ?? variant) : variant;
        const paint = minor ? (minorTone ?? tone) : tone;

        if (!DIGITS.includes(character)) {
          return (
            <Text key={`${index}-static`} style={[type[style] as TextStyle, { color: paint }]}>
              {character}
            </Text>
          );
        }

        return (
          <Digit
            // Keyed by position, not by value: keying by value would
            // remount the column on every change and kill the animation.
            key={`${index}-digit`}
            character={character}
            variant={style}
            tone={paint}
          />
        );
      })}
    </View>
  );
}

function Digit({
  character,
  variant,
  tone,
}: {
  character: string;
  variant: keyof typeof type;
  tone: string;
}) {
  const { reduceMotion } = useVesper();
  const target = DIGITS.indexOf(character);
  const offset = useRef(new Animated.Value(target)).current;

  const style = type[variant] as TextStyle;
  const lineHeight = style.lineHeight ?? 24;

  useEffect(() => {
    if (reduceMotion) {
      offset.setValue(target);
      return;
    }
    const animation = Animated.spring(offset, {
      toValue: target,
      ...spring.digit,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [target, offset, reduceMotion]);

  const translateY = offset.interpolate({
    inputRange: [0, 9],
    outputRange: [0, -lineHeight * 9],
  });

  return (
    <View style={{ height: lineHeight, overflow: "hidden" }}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {DIGITS.map((digit) => (
          <Text
            key={digit}
            style={[
              style,
              {
                color: tone,
                height: lineHeight,
                // Figures must be the same width or the column jitters as
                // it passes through 1.
                fontVariant: ["tabular-nums"],
              },
            ]}
          >
            {digit}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
