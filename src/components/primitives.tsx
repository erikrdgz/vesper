/**
 * The small pieces every screen is assembled from.
 *
 * Strict React Native primitives — `View`, `Text`, `Pressable` — which
 * Expo compiles to `div`, `span` and `button` on the web. Nothing here
 * imports from react-native-web or touches the DOM, so the same components
 * would run on a phone unchanged.
 *
 * Every value comes from `src/theme`. If you find a bare number in this
 * file that is not 0, 1 or a flex weight, it is a bug.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useVesper } from "../hooks/useVesper";
import { color, duration, ease, nativeDriver, radius, shadow, space, type } from "../theme";

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

type TypeVariant = keyof typeof type;

interface TxtProps {
  variant?: TypeVariant;
  /** Any token colour, or a literal when a row needs the positive/negative pair. */
  tone?: keyof typeof color | string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children: React.ReactNode;
  /** Promotes the element to a heading for assistive technology. */
  heading?: boolean;
}

/**
 * Every piece of text in the app goes through here.
 *
 * The point is not convenience, it is that a `<Text>` with its own
 * `fontSize` cannot exist: the variant is the only way to set type, so the
 * matrix in the theme is the complete list of sizes the product uses.
 */
export function Txt({
  variant = "body",
  tone = "text",
  style,
  numberOfLines,
  heading,
  children,
}: TxtProps) {
  const resolved = (color as Record<string, string>)[tone as string] ?? (tone as string);
  return (
    <Text
      style={[type[variant] as TextStyle, { color: resolved }, style]}
      numberOfLines={numberOfLines}
      {...(heading ? { accessibilityRole: "header" as const } : null)}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Padding inside the card. `none` is for cards that hold their own rows. */
  padding?: keyof typeof space | "none";
  /** Steps the surface up one level, for a card inside a card. */
  raised?: boolean;
  /** Fills with the card gradient rather than a flat surface. */
  gradient?: boolean;
}

export function Card({ children, style, padding = "lg", raised, gradient }: CardProps) {
  const inner: ViewStyle = {
    padding: padding === "none" ? 0 : space[padding],
  };

  if (gradient) {
    return (
      <LinearGradient
        colors={["#1B2230", "#141A24"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, shadow.card, inner, style]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.card,
        shadow.card,
        { backgroundColor: raised ? color.cardRaised : color.card },
        inner,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A hairline rule. Used between rows, never around them. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

/** An uppercase section label with optional trailing content. */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="micro" tone="textMuted">
        {title}
      </Txt>
      {action}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Change indicators                                                   */
/* ------------------------------------------------------------------ */

/**
 * The +2.47% chip.
 *
 * Tinted rather than solid, because a screen with six saturated green and
 * red blocks on it reads as an alarm panel. The accent stays reserved for
 * things you can press.
 */
export function Delta({
  value,
  label,
  size = "caption",
  surface = "dark",
}: {
  /** Percentage change. The sign decides the colour. */
  value: number;
  /** Text to show. Defaults to the formatted percentage. */
  label: string;
  size?: "caption" | "micro";
  /**
   * Which ground it sits on. The mint and coral pair is tuned for the dark
   * surfaces; dropped onto the lime hero card they turn muddy, so there
   * the chip goes monochrome and the arrow in the label carries the sign.
   */
  surface?: "dark" | "lime";
}) {
  const flat = Math.abs(value) < 0.005;

  if (surface === "lime") {
    return (
      <View style={[styles.delta, { backgroundColor: "rgba(11, 14, 20, 0.14)" }]}>
        <Text style={[type[size] as TextStyle, { color: color.accentInk }]}>{label}</Text>
      </View>
    );
  }

  const tone = flat ? color.textSecondary : value > 0 ? color.positive : color.negative;
  const tint = flat
    ? "rgba(255,255,255,0.05)"
    : value > 0
      ? color.positiveSoft
      : color.negativeSoft;

  return (
    <View style={[styles.delta, { backgroundColor: tint }]}>
      <Text style={[type[size] as TextStyle, { color: tone }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

/**
 * A pressable that dips slightly when held.
 *
 * `Animated` with the native driver, so the scale runs off the JS thread on
 * a device and as a compositor transform on the web. It respects the
 * reduced-motion preference by skipping the animation rather than
 * shortening it.
 */
export function Tap({
  children,
  style,
  scaleTo = 0.97,
  ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const { reduceMotion } = useVesper();
  const scale = useRef(new Animated.Value(1)).current;

  const to = useCallback(
    (value: number) => {
      if (reduceMotion) return;
      Animated.timing(scale, {
        toValue: value,
        duration: duration.micro,
        easing: ease.standard,
        useNativeDriver: nativeDriver,
      }).start();
    },
    [reduceMotion, scale],
  );

  return (
    <Pressable
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      style={style}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

interface SegmentedProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Chart range". */
  label: string;
}

/** The 1H / 1D / 1W / 1M / 1Y pill row. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text
              style={[
                type.caption as TextStyle,
                { color: active ? color.accentInk : color.textSecondary },
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface ActionProps {
  label: string;
  onPress: () => void;
  /** `primary` is the lime fill. One per screen. */
  variant?: "primary" | "secondary" | "quiet";
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function Action({
  label,
  onPress,
  variant = "secondary",
  icon,
  style,
  disabled,
}: ActionProps) {
  const [hovered, setHovered] = useState(false);

  const fill =
    variant === "primary"
      ? color.accent
      : variant === "secondary"
        ? hovered
          ? color.cardRaised
          : color.card
        : "transparent";

  const text = variant === "primary" ? color.accentInk : color.text;

  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={style}
    >
      <View
        style={[
          styles.action,
          { backgroundColor: fill, opacity: disabled ? 0.45 : 1 },
          variant === "secondary" && styles.actionBordered,
          variant === "primary" && shadow.glow,
        ]}
      >
        {icon}
        <Text style={[type.title as TextStyle, { color: text }]}>{label}</Text>
      </View>
    </Tap>
  );
}

/**
 * The round quick-action buttons under the balance: withdraw, top up, swap.
 *
 * Icon above label rather than beside it, because three of these side by
 * side in a 35% column have no room for horizontal labels.
 */
export function QuickAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={styles.quickAction}
    >
      <View style={styles.quickActionInner}>
        <View style={[styles.quickIcon, hovered && { borderColor: color.hairlineStrong }]}>
          {icon}
        </View>
        <Txt variant="caption" tone="textSecondary">
          {label}
        </Txt>
      </View>
    </Tap>
  );
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * The circle with initials, used for institutions and counterparties.
 *
 * Colour is derived from the name rather than stored, so a newly added
 * account gets a stable colour without anyone choosing one.
 */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `hsl(${hue}, 42%, 22%)`,
        },
      ]}
    >
      <Text style={[type.caption as TextStyle, { color: `hsl(${hue}, 70%, 78%)` }]}>
        {initials}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.hairline,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: color.hairline,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  delta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.xs,
  },
  segmented: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: color.well,
    borderRadius: radius.pill,
    padding: space.xxs,
    gap: space.hair,
  },
  segment: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: color.accent,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  actionBordered: {
    borderWidth: 1,
    borderColor: color.hairline,
  },
  quickAction: {
    flex: 1,
  },
  quickActionInner: {
    alignItems: "center",
    gap: space.xs,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.cardRaised,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
});
