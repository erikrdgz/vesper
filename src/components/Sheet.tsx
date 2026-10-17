/**
 * The modal surface behind the FAB.
 *
 * One component serves both breakpoints, because the content is identical
 * and only the entrance differs: it rises from the bottom edge on a phone
 * and fades up in the centre on a desktop. Two components would have meant
 * two forms to keep in step.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { color, duration, ease, nativeDriver, radius, shadow, space } from "../theme";
import { CloseIcon } from "./icons";
import { Txt } from "./primitives";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const { isDesktop } = useResponsive();
  const { height } = useWindowDimensions();
  const { reduceMotion } = useVesper();

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(open ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      // Exits are shorter than entrances; a slow exit reads as hesitation.
      duration: open ? duration.short : duration.micro,
      easing: open ? ease.entrance : ease.exit,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [open, progress, reduceMotion]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isDesktop ? 24 : Math.min(height * 0.4, 360), 0],
  });

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={[styles.root, isDesktop ? styles.rootDesktop : styles.rootMobile]}>
        {/* The backdrop is a button so Escape is not the only way out. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.panel,
            isDesktop ? styles.panelDesktop : styles.panelMobile,
            shadow.lifted,
            { opacity: progress, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.header}>
            <Txt variant="h2" heading>
              {title}
            </Txt>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.close}
            >
              <CloseIcon size={18} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootDesktop: {
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  rootMobile: {
    justifyContent: "flex-end",
  },
  scrim: {
    backgroundColor: color.scrim,
  },
  panel: {
    backgroundColor: color.groundRaised,
    borderWidth: 1,
    borderColor: color.hairline,
    maxHeight: "86%",
  },
  panelDesktop: {
    width: "100%",
    maxWidth: 460,
    borderRadius: radius.xl,
  },
  panelMobile: {
    width: "100%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    // Clears the home indicator without a safe-area dependency.
    paddingBottom: space.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.card,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    gap: space.md,
  },
});
