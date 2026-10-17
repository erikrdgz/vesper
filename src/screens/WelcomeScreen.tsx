/**
 * The welcome.
 *
 * Before this, the app opened straight onto a dense grid of someone
 * else's money and greeted you as Leonard Lopez. Three questions fix
 * that: here is what this is, what should we call you, and would you
 * rather look around a sample book or start with your own.
 *
 * It runs once. Every step is skippable, because an onboarding you
 * cannot leave is a toll booth.
 */

import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { useResponsive } from "../hooks/useResponsive";
import { useVesper } from "../hooks/useVesper";
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
  const { finishOnboarding } = useVesper();
  const { isDesktop } = useResponsive();

  const [step, setStep] = useState<Step>("what");
  const [name, setName] = useState("");
  const fade = useRef(new Animated.Value(1)).current;

  const index = STEPS.indexOf(step);

  /** Cross-fade between steps so the panel does not jump. */
  function go(next: Step) {
    Animated.sequence([
      Animated.timing(fade, {
        toValue: 0,
        duration: duration.micro,
        easing: ease.exit,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: duration.short,
        easing: ease.entrance,
        useNativeDriver: nativeDriver,
      }),
    ]).start();
    // Swap the content at the midpoint rather than after, so the fade
    // out covers the change.
    setTimeout(() => setStep(next), duration.micro);
  }

  const seededTotal = seedAssets.reduce(
    (sum, asset) => sum + (asset.class === "tradfi" && asset.kind !== "credit" ? asset.balanceUsd : 0),
    0,
  );

  return (
    <View style={styles.root}>
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
              <Txt variant="h1" heading>
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
                <Fact icon={<ArrowUpRightIcon size={16} tone={color.accent} />} text="Everything stays in this browser" />
              </View>
            </View>
          )}

          {step === "who" && (
            <View style={styles.body}>
              <Txt variant="h1" heading>
                What should we call you?
              </Txt>
              <Txt variant="body" tone="textSecondary">
                Only so the app can greet you properly. It is stored in this browser and sent
                nowhere — there is no account to make.
              </Txt>
              <Field
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="Alex"
              />
              <Txt variant="caption" tone="textMuted">
                Leave it blank and Vesper will keep the sample profile.
              </Txt>
            </View>
          )}

          {step === "how" && (
            <View style={styles.body}>
              <Txt variant="h1" heading>
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
          {index > 0 ? (
            <Pressable
              onPress={() => go(STEPS[index - 1]!)}
              accessibilityRole="button"
              style={styles.back}
            >
              <Txt variant="micro" tone="textMuted">
                BACK
              </Txt>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => finishOnboarding("", false)}
              accessibilityRole="button"
              style={styles.back}
            >
              <Txt variant="micro" tone="textMuted">
                SKIP
              </Txt>
            </Pressable>
          )}

          {step !== "how" && (
            <Action
              label={step === "what" ? "Start" : "Next"}
              variant="primary"
              onPress={() => go(STEPS[index + 1]!)}
            />
          )}
        </View>
      </View>
    </View>
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
    flex: 1,
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
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
  },
});
