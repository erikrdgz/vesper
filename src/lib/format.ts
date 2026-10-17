/**
 * Number formatting.
 *
 * Money on a dashboard has one job: let someone compare two figures at a
 * glance. That argues for consistency over precision, so the rules here are
 * blunt and applied everywhere — no component formats its own currency.
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PCT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$4,500.00". The default for anything you might reconcile against a statement. */
export const usd = (value: number): string => (Number.isFinite(value) ? USD.format(value) : "—");

/** "$4,500". For axis labels and anywhere the cents are noise. */
export const usdWhole = (value: number): string =>
  Number.isFinite(value) ? USD_WHOLE.format(value) : "—";

/**
 * Split a formatted amount into major and minor parts, so the cents can be
 * set smaller and dimmer than the dollars on a display balance.
 * `$6,324.49` becomes `{ major: "$6,324", minor: ".49" }`.
 */
export function usdParts(value: number): { major: string; minor: string } {
  const formatted = usd(value);
  const dot = formatted.lastIndexOf(".");
  if (dot === -1) return { major: formatted, minor: "" };
  return { major: formatted.slice(0, dot), minor: formatted.slice(dot) };
}

/** "+2.47%" / "-3.99%". The sign is always explicit on a change. */
export const pct = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${PCT.format(Math.abs(value))}%`;
};

/** "+$1,204.18" / "−$88.50". Matches `pct`, including the true minus sign. */
export const usdSigned = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${USD.format(Math.abs(value))}`;
};

/**
 * Token quantities. Crypto amounts span eight orders of magnitude, so the
 * precision scales with the size: 0.42 BTC keeps its decimals, 320 LINK
 * does not need four of them.
 */
export const tokenAmount = (value: number, symbol?: string): string => {
  if (!Number.isFinite(value)) return "—";
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : 6;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
  return symbol ? `${formatted} ${symbol}` : formatted;
};

/** "0.4%" through "41%". Allocation never needs two decimals. */
export const weight = (fraction: number): string => {
  if (!Number.isFinite(fraction) || fraction <= 0) return "0%";
  const asPct = fraction * 100;
  return `${asPct < 1 ? asPct.toFixed(1) : Math.round(asPct)}%`;
};

/** "Today, 12:15" / "26 March, 16:24". Matches how the transfer rows read. */
export function transactionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday = date.toDateString() === yesterday.toDateString();

  if (sameDay) return `Today, ${time}`;
  if (wasYesterday) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${time}`;
}

/** "Updated 12s ago". Used next to the price-source label. */
export function relativeTime(epochMs: number | null): string {
  if (!epochMs) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * The timestamp under a crosshair.
 *
 * Shows the detail the range justifies: a point on a one-hour chart needs
 * its minute, a point on a one-year chart does not, and printing seconds
 * on either would just be noise that changes as you scrub.
 */
export function chartTime(epochMs: number, range: string): string {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "—";

  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  if (range === "1H" || range === "1D") return time;
  if (range === "1Y") return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return `${day}, ${time}`;
}

/**
 * "Good morning" / "Good afternoon" / "Good evening".
 *
 * Vesper means the evening star, so the evening greeting is the one the
 * product is named for. The other two still have to be right, because a
 * finance app that tells you good evening at 9am reads as broken.
 */
/**
 * "Friday, 17 October". The day the opening is addressed from.
 *
 * No year. Anyone reading a dashboard knows what year it is, and the line
 * is there to anchor the greeting to a day rather than to file it.
 */
export function today(now = new Date()): string {
  return now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * "10 Oct". The short form a chart's axis wants.
 *
 * `chartTime` carries a time of day with it, which is right for a readout
 * that follows the pointer and far too much for a label that sits under
 * one end of a week-long line.
 */
export function shortDate(epochMs: number): string {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Leonard Lopez" -> "Leonard". For a greeting, not a label. */
export const firstName = (full: string): string => full.trim().split(/\s+/)[0] ?? full;

/** "1 position" / "2 positions". Pluralise, or the UI reads as a draft. */
export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;
