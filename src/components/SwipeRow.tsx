/**
 * Swipe a row sideways to reveal what you can do to it.
 *
 * Built on React Native's pointer event props rather than
 * `PanResponder`. PanResponder is the textbook answer and it was the
 * first attempt, but under react-native-web 0.21 its handlers never
 * fired here — the inner `Pressable` takes the responder on touch-down
 * and the pan never gets it back, even asking in the capture phase.
 * `onPointerDown` and friends are first-class RN props since 0.71, they
 * work on both platforms, and the chart crosshair and the 3D tilt
 * already rely on them in this app.
 *
 * The row only starts following the pointer once horizontal travel
 * clearly beats vertical, so a finger scrolling a list is never
 * interrupted by a row deciding it was a swipe.
 */

import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { useVesper } from "../hooks/useVesper";
import { color, duration, ease, radius, space } from "../theme";
import { Txt } from "./primitives";

export interface SwipeAction {
  label: string;
  icon?: React.ReactNode;
  /** Background of the revealed panel. */
  tone: string;
  /** Text and icon colour on that panel. */
  ink?: string;
  onPress: () => void;
}

interface SwipeRowProps {
  children: React.ReactNode;
  /** Revealed by dragging the row to the left. */
  actions: SwipeAction[];
  actionWidth?: number;
  onLongPress?: () => void;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Horizontal travel before the row starts following the pointer. */
const CLAIM_PX = 10;

/** How far across a release has to be to settle open. */
const SETTLE_RATIO = 0.4;

interface PointerLike {
  nativeEvent: { clientX?: number; clientY?: number; pageX?: number; pageY?: number };
}

const xOf = (event: PointerLike) => event.nativeEvent.clientX ?? event.nativeEvent.pageX ?? 0;
const yOf = (event: PointerLike) => event.nativeEvent.clientY ?? event.nativeEvent.pageY ?? 0;

export function SwipeRow({
  children,
  actions,
  actionWidth = 88,
  onLongPress,
  onPress,
  accessibilityLabel,
}: SwipeRowProps) {
  const { reduceMotion } = useVesper();
  const translateX = useRef(new Animated.Value(0)).current;

  /** Where the row sits between gestures, so a drag resumes from there. */
  const resting = useRef(0);
  /** Pointer origin, or null when no drag is in progress. */
  const origin = useRef<{ x: number; y: number } | null>(null);
  /** True once this gesture has been judged a swipe rather than a tap. */
  const dragging = useRef(false);
  const [open, setOpen] = useState(false);

  const openWidth = actionWidth * actions.length;

  function settle(to: number) {
    resting.current = to;
    setOpen(to !== 0);
    if (reduceMotion) {
      translateX.setValue(to);
      return;
    }
    Animated.timing(translateX, {
      toValue: to,
      duration: duration.short,
      easing: ease.standard,
      // The drag writes this value directly, which a native driver
      // cannot do from the JS side.
      useNativeDriver: false,
    }).start();
  }

  function onPointerDown(event: PointerLike) {
    if (actions.length === 0) return;
    origin.current = { x: xOf(event), y: yOf(event) };
    dragging.current = false;
  }

  function onPointerMove(event: PointerLike) {
    const from = origin.current;
    if (!from) return;

    const dx = xOf(event) - from.x;
    const dy = yOf(event) - from.y;

    if (!dragging.current) {
      // Vertical intent wins outright: let the list scroll and give up
      // on this gesture entirely rather than fighting it.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > CLAIM_PX) {
        origin.current = null;
        return;
      }
      if (!(Math.abs(dx) > CLAIM_PX && Math.abs(dx) > Math.abs(dy) * 1.4)) return;
      dragging.current = true;
    }

    translateX.setValue(Math.max(-openWidth, Math.min(resting.current + dx, 0)));
  }

  function onPointerUp(event: PointerLike) {
    const from = origin.current;
    origin.current = null;
    if (!from || !dragging.current) return;

    const next = resting.current + (xOf(event) - from.x);
    settle(next < -openWidth * SETTLE_RATIO ? -openWidth : 0);
    dragging.current = false;
  }

  return (
    <View style={styles.root}>
      {actions.length > 0 && (
        <View style={styles.actions} pointerEvents="box-none">
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                settle(0);
                action.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={[styles.action, { width: actionWidth, backgroundColor: action.tone }]}
            >
              {action.icon}
              <Txt variant="micro" style={{ color: action.ink ?? color.accentInk }}>
                {action.label.toUpperCase()}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}

      <Animated.View
        style={{ transform: [{ translateX }] }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          origin.current = null;
          settle(resting.current);
        }}
      >
        <Pressable
          onPress={() => {
            // A drag that happened to end on this row is not a tap, and
            // a tap while open closes rather than activating — which is
            // what a thumb reaching for a half-open row expects.
            if (dragging.current) return;
            if (open) {
              settle(0);
              return;
            }
            onPress?.();
          }}
          onLongPress={onLongPress}
          delayLongPress={380}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={styles.face}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
  },
  actions: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.xxs,
  },
  face: {
    backgroundColor: color.card,
    borderRadius: radius.xs,
  },
});
