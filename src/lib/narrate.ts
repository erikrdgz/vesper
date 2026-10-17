/**
 * Saying what happened, in words.
 *
 * Every screen in Vesper could tell you a number and none of them could
 * tell you anything. A dashboard that opens with "$146,515.53" and four
 * charts has handed you the raw material and left the reading to you,
 * which is the part a person actually wants done.
 *
 * These functions turn the same data the charts draw into one or two
 * sentences. The rules are deliberately conservative: it only says
 * something is notable when it is, it never rounds a loss into a win,
 * and when nothing has happened it says so rather than inventing drama.
 */

import { isDeFi, type NetWorth, type PriceAlert, type ValuedAsset } from "../types";
import { usd, usdSigned } from "./format";

/** Below this, a day's move is noise rather than news. */
const QUIET_PCT = 0.15;

/** A position above this share of the book is worth mentioning. */
const CONCENTRATION = 0.4;

export interface Headline {
  /** One sentence on the day. Always present. */
  lead: string;
  /** An optional second sentence: a mover, a concentration, an alert. */
  detail?: string;
  /** Drives the colour of any accent next to it. */
  tone: "up" | "down" | "flat";
}

/** The largest absolute 24h mover among priced holdings. */
function biggestMover(netWorth: NetWorth): ValuedAsset | null {
  const priced = netWorth.valued.filter((entry) => isDeFi(entry.asset) && entry.priced);
  if (priced.length === 0) return null;

  return priced.reduce((worst, entry) =>
    Math.abs(entry.change24hUsd) > Math.abs(worst.change24hUsd) ? entry : worst,
  );
}

/**
 * What to say at the top of the overview.
 *
 * The lead is about today, because that is what someone opening a
 * portfolio app wants to know. The detail earns its place only if there
 * is something specific to point at.
 */
export function headline(netWorth: NetWorth, alerts: PriceAlert[] = []): Headline {
  if (netWorth.valued.length === 0) {
    return { lead: "Nothing in the book yet.", tone: "flat" };
  }

  // A book of only stated balances cannot have a day. Saying "flat"
  // would imply a market that did not move, which is not what happened.
  if (netWorth.deFiUsd === 0) {
    return {
      lead: `${usd(netWorth.totalUsd)} across ${netWorth.valued.length} accounts.`,
      detail: "Stated balances only, so there is no daily movement to report.",
      tone: "flat",
    };
  }

  const quiet = Math.abs(netWorth.change24hPct) < QUIET_PCT;
  const up = netWorth.change24hUsd >= 0;
  const mover = biggestMover(netWorth);

  const lead = quiet
    ? "A quiet day. Nothing has moved much."
    : up
      ? `Up ${usd(netWorth.change24hUsd)} today.`
      : `Down ${usd(Math.abs(netWorth.change24hUsd))} today.`;

  // An alert that has fired outranks anything else we could say.
  const fired = alerts.find((alert) => alert.triggeredAt !== null);
  if (fired) {
    return {
      lead,
      detail: `${fired.symbol} crossed ${usd(fired.priceUsd)}, which you asked to know about.`,
      tone: quiet ? "flat" : up ? "up" : "down",
    };
  }

  let detail: string | undefined;

  if (!quiet && mover && Math.abs(mover.change24hUsd) > 0) {
    const symbol = isDeFi(mover.asset) ? mover.asset.symbol : mover.asset.label;
    const sameWay = mover.change24hUsd >= 0 === up;
    detail = sameWay
      ? `${symbol} is doing most of the work, ${usdSigned(mover.change24hUsd)}.`
      : `${symbol} went the other way, ${usdSigned(mover.change24hUsd)}.`;
  } else {
    const heaviest = netWorth.valued.find((entry) => entry.weight >= CONCENTRATION);
    if (heaviest) {
      detail = `${heaviest.asset.label} is ${Math.round(heaviest.weight * 100)}% of everything you hold.`;
    } else if (netWorth.costUsd > 0) {
      detail = `You are ${netWorth.gainUsd >= 0 ? "up" : "down"} ${usd(
        Math.abs(netWorth.gainUsd),
      )} overall on ${usd(netWorth.costUsd)} invested.`;
    }
  }

  return { lead, detail, tone: quiet ? "flat" : up ? "up" : "down" };
}

export interface Observation {
  title: string;
  body: string;
  tone: "up" | "down" | "flat";
}

/**
 * The reading for the Analytics screen.
 *
 * Several short observations rather than one sentence, because this is
 * the screen someone came to in order to understand something. Each one
 * has to be true of the current data and worth the row — nothing here
 * fires on an empty or trivial condition.
 */
export function observations(netWorth: NetWorth, realisedUsd = 0): Observation[] {
  const out: Observation[] = [];
  const tracked = netWorth.valued.filter((entry) => entry.gainPct !== null);

  if (tracked.length > 0) {
    const best = tracked.reduce((a, b) => ((b.gainPct ?? 0) > (a.gainPct ?? 0) ? b : a));
    const worst = tracked.reduce((a, b) => ((b.gainPct ?? 0) < (a.gainPct ?? 0) ? b : a));

    const bestIsUp = (best.gainUsd ?? 0) > 0;
    const worstIsDown = (worst.gainUsd ?? 0) < 0;

    if (bestIsUp) {
      out.push({
        title: "Best position",
        body: `${best.asset.label} is up ${usd(best.gainUsd ?? 0)}, ${Math.round(
          best.gainPct ?? 0,
        )}% on what you put in.`,
        tone: "up",
      });
    }

    // With one holding, best and worst are the same row. It still gets
    // reported — as the weakest, if it is losing. Suppressing it on the
    // grounds that it was already the best meant a single underwater
    // position produced no observation at all.
    if (worstIsDown && (!bestIsUp || worst.asset.id !== best.asset.id)) {
      out.push({
        title: "Weakest position",
        body: `${worst.asset.label} is down ${usd(Math.abs(worst.gainUsd ?? 0))}, ${Math.round(
          Math.abs(worst.gainPct ?? 0),
        )}% below cost.`,
        tone: "down",
      });
    }
  }

  const heaviest = netWorth.valued.find((entry) => entry.weight >= CONCENTRATION);
  if (heaviest) {
    out.push({
      title: "Concentration",
      body: `${heaviest.asset.label} is ${Math.round(
        heaviest.weight * 100,
      )}% of everything you hold. A single position that size moves the whole book.`,
      tone: "flat",
    });
  }

  const cryptoShare =
    netWorth.tradFiUsd + netWorth.deFiUsd > 0
      ? netWorth.deFiUsd / (netWorth.tradFiUsd + netWorth.deFiUsd)
      : 0;
  if (cryptoShare > 0.5) {
    out.push({
      title: "Marked to market",
      body: `${Math.round(cryptoShare * 100)}% of the book is priced live, so most of your net worth changes by the minute.`,
      tone: "flat",
    });
  }

  if (netWorth.liabilitiesUsd > 0 && netWorth.liabilitiesUsd / netWorth.totalUsd > 0.05) {
    out.push({
      title: "Owed",
      body: `${usd(netWorth.liabilitiesUsd)} on credit, which is ${Math.round(
        (netWorth.liabilitiesUsd / netWorth.totalUsd) * 100,
      )}% of your net worth.`,
      tone: "down",
    });
  }

  if (realisedUsd !== 0) {
    out.push({
      title: "Realised",
      body: `${usdSigned(realisedUsd)} has been taken out of positions by swaps. That part has stopped moving with the market.`,
      tone: realisedUsd >= 0 ? "up" : "down",
    });
  }

  return out;
}
