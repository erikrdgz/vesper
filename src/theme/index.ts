/**
 * Vesper's design tokens.
 *
 * This is the file to tune. Every number the UI uses comes from here, and
 * nothing in `src/screens` or `src/components` is allowed to invent one.
 * If a value appears twice in a component file, it belongs in this file
 * instead.
 *
 * Dark is not a mode here, it is the only ground. A wealth dashboard is
 * read in the evening more than the morning, and the whole palette is built
 * on the assumption that the screen is the brightest thing in the room.
 */

import { Easing, Platform, type TextStyle, type ViewStyle } from "react-native";

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/**
 * Three greys and one loud green.
 *
 * The greys are blue-biased (every one of them has more blue than red) so
 * that the lime reads as warm against them. A neutral grey would have made
 * the accent look sickly rather than electric.
 */
export const color = {
  /** App ground. Everything sits on this. */
  ground: "#0B0E14",
  /** Sheets and modals, one step up from ground so the backdrop reads. */
  groundRaised: "#10141D",
  /** The default card surface. */
  card: "#151A24",
  /** A card on a card. Used sparingly; two steps is the limit. */
  cardRaised: "#1B2230",
  /** Inputs and pressed states, one step down from card. */
  well: "#0F131B",

  /** Borders. The strong one is for focus and selection only. */
  hairline: "rgba(255, 255, 255, 0.07)",
  hairlineStrong: "rgba(255, 255, 255, 0.14)",

  /**
   * Acid lime. The one saturated colour in the product, which is why it is
   * reserved for the primary action and the live data point. The moment it
   * appears on a decorative element it stops meaning anything.
   */
  accent: "#C4F82A",
  /** Text and icons placed on top of `accent`. Never white. */
  accentInk: "#0B0E14",
  /** Accent at tint strength, for chips and selected pills. */
  accentSoft: "rgba(196, 248, 42, 0.14)",
  /** Accent for glows. See `shadow.glow`. */
  accentGlow: "rgba(196, 248, 42, 0.38)",

  /** Gains. Mint, deliberately cooler and quieter than the accent. */
  positive: "#10B981",
  positiveSoft: "rgba(16, 185, 129, 0.14)",

  /** Losses. Coral rather than red; red next to lime vibrates. */
  negative: "#F4603E",
  negativeSoft: "rgba(244, 96, 62, 0.14)",

  /** Type. Four steps, and four is enough. */
  text: "#F2F5F9",
  textSecondary: "#8C96A9",
  textMuted: "#5A6477",
  textInverse: "#0B0E14",

  /** Scrims. */
  scrim: "rgba(5, 7, 11, 0.72)",
} as const;

/**
 * Gradients, as colour-stop arrays for `expo-linear-gradient`.
 *
 * The hero card is the one place the product uses a gradient, and it is
 * doing a job: the balance sits in the bright corner, so the eye lands on
 * the number before it lands on the card.
 */
export const gradient = {
  /** The headline balance card. Lime, falling to a deep olive. */
  hero: ["#D6FF4B", "#A8E018", "#6F9C0F"] as const,
  /** Behind the chart fill, fading to nothing. */
  chart: ["rgba(196, 248, 42, 0.32)", "rgba(196, 248, 42, 0.02)"] as const,
  /** Ambient bloom behind the hero, on the ground. */
  bloom: ["rgba(196, 248, 42, 0.16)", "rgba(196, 248, 42, 0)"] as const,
  /** A card that is not the hero but still needs depth. */
  card: ["#1B2230", "#141A24"] as const,
} as const;

/* ------------------------------------------------------------------ */
/* Elevation                                                           */
/* ------------------------------------------------------------------ */

/**
 * Shadows, including the coloured glow the whole look rests on.
 *
 * react-native-web renders these as `box-shadow`, iOS as a layer shadow.
 * Android cannot tint a shadow at all, so `glow` degrades to a plain
 * elevation there. Web is the shipping target, so that is an acceptable
 * trade rather than a bug.
 */
export const shadow: Record<string, ViewStyle> = {
  /** Default card lift. Almost invisible, which is the point. */
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  /** Sheets and the FAB. */
  lifted: {
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  /**
   * The accent glow. Used on the hero card and the FAB and nowhere else;
   * a second glowing element halves the effect of the first.
   */
  glow: {
    shadowColor: color.accent,
    shadowOpacity: Platform.OS === "android" ? 0 : 0.42,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
};

/* ------------------------------------------------------------------ */
/* Space and shape                                                     */
/* ------------------------------------------------------------------ */

/** A 4pt scale. Named, because `space.lg` survives a redesign and `24` does not. */
export const space = {
  hair: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  giant: 64,
} as const;

/** Corner radii. Cards are 22; anything smaller inside them steps down. */
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Hairline-ish border widths. */
export const border = {
  hair: 1,
  focus: 2,
} as const;

/* ------------------------------------------------------------------ */
/* Type                                                                */
/* ------------------------------------------------------------------ */

/**
 * One family, swapped in one place.
 *
 * System stacks on both platforms for now. The web stack is ordered so that
 * macOS and iOS get SF, Windows gets Segoe, and everything else gets Inter
 * if it happens to be installed. Swapping in a loaded webfont is a change
 * to this constant and nothing else.
 */
export const fontFamily = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", system-ui, sans-serif',
  default: "System",
}) as string;

/**
 * The type matrix.
 *
 * Balances and the greeting are the only things allowed above 24pt, and
 * they are tracked tight because long strings at display size fall apart
 * otherwise. Captions and micro labels are tracked loose for the opposite
 * reason.
 */
export const type = {
  /**
   * The opening greeting, and the only non-numeric type at this size.
   *
   * It is a size up from `display` and a weight down from it: the line is
   * the first thing on the screen and wants height rather than mass, and
   * at 700 two lines of it read as a headline about the person rather
   * than a greeting to them.
   */
  greeting: {
    fontFamily,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "600",
    letterSpacing: -1.2,
  },
  /** The one hero balance per screen. */
  displayXl: {
    fontFamily,
    fontSize: 46,
    lineHeight: 50,
    fontWeight: "700",
    letterSpacing: -1.4,
  },
  /** Secondary balances: an asset's price, a card total. */
  display: {
    fontFamily,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -1,
  },
  /** Screen titles. */
  h1: { fontFamily, fontSize: 24, lineHeight: 29, fontWeight: "700", letterSpacing: -0.4 },
  /** Section headings. */
  h2: { fontFamily, fontSize: 19, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2 },
  /** Row titles, button labels. */
  title: { fontFamily, fontSize: 16, lineHeight: 21, fontWeight: "600" },
  body: { fontFamily, fontSize: 15, lineHeight: 21, fontWeight: "400" },
  bodyStrong: { fontFamily, fontSize: 15, lineHeight: 21, fontWeight: "600" },
  /** Secondary row text, timestamps, helper copy. */
  caption: { fontFamily, fontSize: 13, lineHeight: 17, fontWeight: "500" },
  /** Eyebrows and axis labels. Always uppercase at this size. */
  micro: {
    fontFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  /** Tabular figures for anything in a column that has to line up. */
  mono: {
    fontFamily: Platform.select({
      web: 'ui-monospace, "SF Mono", Menlo, monospace',
      default: "Menlo",
    }) as string,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
  },
} satisfies Record<string, TextStyle>;

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/**
 * The responsive contract, in one object.
 *
 * Above `breakpoint` the app is a two-column desk; below it, a phone. There
 * is exactly one breakpoint, because two breakpoints means three layouts to
 * keep honest and we only have content for two.
 */
export const layout = {
  /** The single breakpoint. Above this, desktop chrome. */
  breakpoint: 768,
  /** Content never exceeds this, however wide the window gets. */
  maxWidth: 1200,
  /** Left column: charts and holdings. */
  primaryColumn: 0.65,
  /** Right column: actions, profile, add-asset. */
  secondaryColumn: 0.35,
  /** Gap between the two columns. */
  columnGap: space.xl,
  /** Page padding, per side. */
  gutter: { mobile: space.lg, desktop: space.xxl },
  /**
   * The two numbers that decide whether the grid reads as a terminal or
   * as a set of bento blocks.
   *
   * `paneGap: 1` with `paneRadius: 0` gives hairline rules and full
   * bleed — a trading terminal. Raising the gap and the radius lets the
   * ground show between panes and turns them into blocks. Nothing else
   * in the app has to change to move between the two.
   */
  paneGap: 10,
  paneRadius: 18,
  /** Padding around the whole grid, so blocks do not touch the window. */
  paneInset: 10,

  /** Desktop left nav rail. */
  railWidth: 232,
  /** Mobile bottom tab bar. */
  tabBarHeight: 64,
} as const;

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/**
 * Four curves, borrowed from the motion system on erikrodriguez.design,
 * which took them from Apple's own published custom properties rather than
 * from a blog post about them.
 *
 * The part worth keeping is the mismatch in `duration`: a revealing element
 * fades for longer than it travels, so it settles rather than arrives.
 */
export const ease = {
  /** In-place state change: toggles, colour, chrome. Symmetric, no overshoot. */
  standard: Easing.bezier(0.4, 0, 0.6, 1),
  /** Arrivals. Starts at speed, brakes. */
  entrance: Easing.bezier(0.25, 0.1, 0.3, 1),
  /** The dramatic one. Hold, move, settle. One element per screen, at most. */
  dramatic: Easing.bezier(0.66, 0, 0.1, 1),
  /** Exits only. A slow exit reads as hesitation. */
  exit: Easing.bezier(0.4, 0, 1, 1),
} as const;

/** Durations in milliseconds, because that is what `Animated.timing` wants. */
export const duration = {
  micro: 200,
  short: 320,
  medium: 500,
  /** Reveal: how far the travel lasts. */
  rise: 700,
  /** Reveal: how long it keeps fading. Longer than `rise`, deliberately. */
  fade: 900,
} as const;

/** How far a revealing element travels, in points. */
export const rise = 30;

/**
 * Spring configurations, for anything a hand drives.
 *
 * The four curves above are fixed-duration, which is right for a reveal:
 * it is choreography, and choreography has a running time. It is wrong for
 * a cursor-tracked tilt or a press, which should feel attached to the
 * input rather than scheduled after it. Those get springs.
 */
export const spring = {
  /** Presses and hovers. Fast, no visible overshoot. */
  press: { tension: 320, friction: 26 },
  /** Cursor tracking. Loose enough to lag slightly, which reads as weight. */
  track: { tension: 120, friction: 18 },
  /** The 3D flip. Deliberate overshoot; it is the one place that earns it. */
  flip: { tension: 180, friction: 14 },
  /** Digit rolls on a changing balance. */
  digit: { tension: 200, friction: 22 },
} as const;

/** Delay between items in a staggered group, and the cap on that delay. */
export const stagger = { step: 70, cap: 6 } as const;

/** Stagger delay for index `i`, capped so long lists do not crawl. */
export const staggerDelay = (i: number) => Math.min(i, stagger.cap) * stagger.step;

/* ------------------------------------------------------------------ */

export const theme = {
  color,
  gradient,
  shadow,
  space,
  radius,
  border,
  type,
  fontFamily,
  layout,
  ease,
  duration,
  spring,
  rise,
  stagger,
  staggerDelay,
} as const;

export type Theme = typeof theme;
export default theme;

/**
 * Whether `Animated` may use the native driver.
 *
 * react-native-web has no native animated module, and asking for one logs
 * a warning on every animation. Opacity and transform are compositor
 * properties in a browser anyway, so the JS driver costs nothing here.
 */
export const nativeDriver = Platform.OS !== "web";
