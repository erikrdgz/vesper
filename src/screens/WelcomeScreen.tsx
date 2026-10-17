/**
 * The welcome.
 *
 * Introduce the app, save a name, then choose a sample or empty book.
 *
 * It runs once. Every step is skippable, because an onboarding you
 * cannot leave is a toll booth.
 */

import { useRef, useState } from "react";
import { Animated, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
import { DEFAULT_NAME, profileForName } from "../lib/profile";
import { usd } from "../lib/format";
import { color, duration, ease, nativeDriver, radius, space } from "../theme";
import { VesperMark } from "../components/brand";
import { CoinMark } from "../components/coins";
import { Field } from "../components/Field";
import { ArrowUpRightIcon, WalletIcon, WatchIcon } from "../components/icons";
import { Action, Txt } from "../components/primitives";
import { seedAssets } from "../data/seed";

const STEPS = ["what", "who", "how"] as const;
type Step = (typeof STEPS)[number];

export function WelcomeScreen() {
  const { finishOnboarding, profile, setProfile, reduceMotion } = useVesper();
  const { isDesktop } = useResponsive();

  const [step, setStep] = useState<Step>("what");
  const [name, setName] = useState(profile.name === DEFAULT_NAME ? "" : profile.name);
  const fade = useRef(new Animated.Value(1)).current;

  const index = STEPS.indexOf(step);

  function go(next: Step) {
    fade.stopAnimation();
    setStep(next);
    if (reduceMotion) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: duration.short,
      easing: ease.entrance,
      useNativeDriver: nativeDriver,
    }).start();
  }

  function next() {
    if (step === "who") {
      setProfile(profileForName(name, profile));
      Keyboard.dismiss();
    }
    go(STEPS[index + 1]!);
  }

  const seededTotal = seedAssets.reduce(
    (sum, asset) => sum + (asset.class === "tradfi" && asset.kind !== "credit" ? asset.balanceUsd : 0),
    0,
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
        <View style={[styles.panel, isDesktop && styles.panelDesktop]}>
          <View style={styles.head}>
            <VesperMark size={30} />
            <View style={styles.dots}>
              {STEPS.map((id, i) => (
                <View key={id} style={[styles.dot, i <= index && styles.dotOn]} />
              ))}
            </View>
          </View>

          <Animated.View style={{ opacity: fade }}>
            {step === "what" && (
              <View style={styles.body}>
                <Txt variant="h1" heading style={[styles.heading, isDesktop && styles.headingDesktop]}>
                  Two kinds of money, one page
                </Txt>
                <Txt variant="body" tone="textSecondary">
                  A bank balance is worth what the bank says. Half a Bitcoin is worth whatever the
                  last trade says, and that number is stale by the time it finishes rendering.
                </Txt>
                <Txt variant="body" tone="textSecondary">
                  Vesper keeps those apart all the way down, and tells you which is which on every
                  screen.
                </Txt>

                <View style={styles.facts}>
                  <Fact icon={<WalletIcon size={16} tone={color.accent} />} text="Connects to no bank and holds no keys" />
                  <Fact icon={<WatchIcon size={16} tone={color.accent} />} text="Live crypto prices from CoinGecko" />
                  <Fact icon={<ArrowUpRightIcon size={16} tone={color.accent} />} text="Everything stays on this device" />
                </View>
              </View>
            )}

            {step === "who" && (
              <View style={styles.body}>
                <Txt variant="h1" heading style={[styles.heading, isDesktop && styles.headingDesktop]}>
                  What should we call you?
                </Txt>
                <Txt variant="body" tone="textSecondary">
                  Only so the app can greet you properly. It is stored on this device and sent
                  nowhere — there is no account to make.
                </Txt>
                <Field
                  label="Your name"
                  value={name}
                  onChangeText={setName}
                  placeholder="John Doe"
                  autoComplete="name"
                  autoCapitalize="words"
                  maxLength={80}
                  returnKeyType="next"
                  onSubmitEditing={next}
                />
                <Txt variant="caption" tone="textMuted">
                  Skip or leave this blank to use John Doe.
                </Txt>
              </View>
            )}

            {step === "how" && (
              <View style={styles.body}>
                <Txt variant="h1" heading style={[styles.heading, isDesktop && styles.headingDesktop]}>
                  Where would you like to start?
                </Txt>

                <Pressable
                  onPress={() => finishOnboarding(name, false)}
                  accessibilityRole="button"
                  style={[styles.choice, styles.choicePrimary]}
                >
                  <View style={styles.choiceHead}>
                    <Txt variant="title" tone="accentInk">
                      Explore a sample book
                    </Txt>
                    <View style={styles.coins}>
                      {["BTC", "ETH", "SOL"].map((symbol) => (
                        <CoinMark key={symbol} symbol={symbol} size={20} />
                      ))}
                    </View>
                  </View>
                  <Txt variant="caption" style={styles.onLime}>
                    Five accounts and four tokens, about {usd(seededTotal)} in stated balances, with
                    real prices on the crypto. Edit any of it.
                  </Txt>
                </Pressable>

                <Pressable
                  onPress={() => finishOnboarding(name, true)}
                  accessibilityRole="button"
                  style={styles.choice}
                >
                  <Txt variant="title">Start with an empty book</Txt>
                  <Txt variant="caption" tone="textMuted">
                    Nothing but the watchlist. Add your own accounts and holdings as you go.
                  </Txt>
                </Pressable>
              </View>
            )}
          </Animated.View>

          <View style={styles.foot}>
            {index > 0 && (
              <Pressable
                onPress={() => go(STEPS[index - 1]!)}
                accessibilityRole="button"
                style={styles.back}
              >
                <Txt variant="micro" tone="textMuted">
                  BACK
                </Txt>
              </Pressable>
            )}
            <Pressable
              onPress={() => finishOnboarding(name, false)}
              accessibilityRole="button"
              style={styles.back}
            >
              <Txt variant="micro" tone="textMuted">
                Skip welcome
              </Txt>
            </Pressable>

            {step !== "how" && (
              <Action
                label={step === "what" ? "Start" : "Next"}
                variant="primary"
                onPress={next}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}>{icon}</View>
      <Txt variant="caption" tone="textSecondary" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    backgroundColor: color.ground,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  panel: {
    width: "100%",
    maxWidth: 460,
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  panelDesktop: {
    padding: space.xxl,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    flexDirection: "row",
    gap: space.xxs,
  },
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: color.hairlineStrong,
  },
  dotOn: {
    backgroundColor: color.accent,
  },
  heading: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  headingDesktop: { fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  body: {
    gap: space.sm,
  },
  facts: {
    gap: space.xs,
    marginTop: space.xs,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  factIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.accentSoft,
  },
  choice: {
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.cardRaised,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  choicePrimary: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  choiceHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  coins: {
    flexDirection: "row",
    gap: -6,
  },
  onLime: {
    color: "rgba(11, 14, 20, 0.66)",
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
  },
});
