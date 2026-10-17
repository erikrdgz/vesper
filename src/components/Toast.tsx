/**
 * Telling you it worked.
 *
 * Every action in Vesper used to end the same way: the sheet closed and
 * the numbers behind it were different. That is a state change with no
 * acknowledgement, and it leaves people re-checking whether the thing
 * they just did actually happened.
 *
 * A toast is the smallest honest fix. It names what changed, in the same
 * words the action used, and goes away on its own.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { color, duration, ease, layout, nativeDriver, radius, shadow, space } from "../theme";
import { CloseIcon } from "./icons";
import { Txt } from "./primitives";

export type ToastTone = "neutral" | "positive" | "negative";

interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
}

interface ToastValue {
  /** Show a confirmation. Returns nothing; this is fire and forget. */
  toast: (title: string, detail?: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

/** How long a toast stays. Long enough to read a number, short enough to ignore. */
const DWELL_MS = 3600;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);
  const nextId = useRef(0);

  const toast = useCallback((title: string, detail?: string, tone: ToastTone = "neutral") => {
    nextId.current += 1;
    // One at a time, newest wins. A stack of toasts is a notification
    // centre, which is a different thing and not one this app needs.
    setCurrent({ id: nextId.current, title, detail, tone });
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current && (
        <ToastView
          key={current.id}
          toast={current}
          onDismiss={() => setCurrent((shown) => (shown?.id === current.id ? null : shown))}
        />
      )}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { reduceMotion } = useVesper();
  const { isDesktop } = useResponsive();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      const timer = setTimeout(onDismiss, DWELL_MS);
      return () => clearTimeout(timer);
    }

    const enter = Animated.timing(progress, {
      toValue: 1,
      duration: duration.short,
      easing: ease.entrance,
      useNativeDriver: nativeDriver,
    });
    enter.start();

    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: duration.micro,
        easing: ease.exit,
        useNativeDriver: nativeDriver,
      }).start(({ finished }) => {
        if (finished) onDismiss();
      });
    }, DWELL_MS);

    return () => {
      enter.stop();
      clearTimeout(timer);
    };
  }, [progress, reduceMotion, onDismiss]);

  const accent =
    toast.tone === "positive"
      ? color.positive
      : toast.tone === "negative"
        ? color.negative
        : color.accent;

  return (
    <Animated.View
      // Rises from the bottom on a phone, where the thumb is, and drops
      // from the command bar on a desktop, where the action was.
      style={[
        styles.root,
        isDesktop ? styles.rootDesktop : styles.rootMobile,
        shadow.lifted,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [isDesktop ? -16 : 24, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={[styles.stripe, { backgroundColor: accent }]} />
      <View style={styles.copy}>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {toast.title}
        </Txt>
        {toast.detail ? (
          <Txt variant="caption" tone="textMuted" numberOfLines={2}>
            {toast.detail}
          </Txt>
        ) : null}
      </View>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={styles.close}
      >
        <CloseIcon size={14} />
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastValue {
  const context = useContext(ToastContext);
  // Deliberately forgiving: a component that confirms an action should
  // not crash the screen because it was rendered outside the provider.
  return context ?? { toast: () => {} };
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingRight: space.xs,
    borderRadius: radius.md,
    backgroundColor: color.groundRaised,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    overflow: "hidden",
    maxWidth: 420,
  },
  rootDesktop: {
    top: space.md,
    right: space.md,
    minWidth: 280,
  },
  rootMobile: {
    left: layout.paneInset,
    right: layout.paneInset,
    bottom: layout.tabBarHeight + space.md,
  },
  stripe: {
    width: 3,
    alignSelf: "stretch",
  },
  copy: {
    flex: 1,
    gap: 1,
    paddingVertical: space.sm,
  },
  close: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
});
