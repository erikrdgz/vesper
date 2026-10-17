/**
 * Reading a book back in.
 *
 * The export was only half a door. This parses the same shape back,
 * which means a spreadsheet is a legitimate way to set Vesper up — edit
 * forty positions in a tool built for editing forty positions, then
 * bring them over.
 *
 * It is deliberately forgiving about everything except the numbers.
 * Column order, casing and extra columns are all fine; a quantity that
 * will not parse is not, because a silently-dropped digit becomes a
 * wrong balance that nobody questions.
 */

import { TOKEN_CATALOG } from "../data/catalog";
import type { Asset, TradFiKind } from "../types";

export interface ImportResult {
  assets: Asset[];
  /** One line per row we could not use, in the order they appeared. */
  skipped: string[];
}

/**
 * Split one CSV line, honouring RFC 4180 quoting.
 *
 * Written out rather than split(",") because a label like
 * "Vanguard, Total Market" is both plausible and exactly what breaks
 * the naive version.
 */
export function parseLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted cell is a literal quote.
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}

/** "$1,234.50" -> 1234.5. Returns null when it is not a number. */
function money(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const KINDS: Record<string, TradFiKind> = {
  cash: "cash",
  brokerage: "brokerage",
  retirement: "retirement",
  credit: "credit",
};

/**
 * Turn exported CSV back into assets.
 *
 * Matches columns by header name so the file can be reordered or have
 * columns added by a spreadsheet without breaking. Rows that cannot be
 * made into a valid asset are collected rather than dropped, so the UI
 * can say what was ignored and why.
 */
export function parsePositions(csv: string): ImportResult {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return { assets: [], skipped: [] };

  const header = parseLine(lines[0]!).map((cell) => cell.toLowerCase());
  const at = (name: string) => header.indexOf(name);

  const nameAt = at("name");
  const kindAt = at("kind");
  const symbolAt = at("symbol");
  const quantityAt = at("quantity");
  const valueAt = at("value usd");
  const costAt = at("cost usd");

  if (nameAt === -1) return { assets: [], skipped: ["No Name column, so there is nothing to read."] };

  const assets: Asset[] = [];
  const skipped: string[] = [];
  let serial = 0;

  for (const line of lines.slice(1)) {
    const cells = parseLine(line);
    const label = cells[nameAt] ?? "";
    if (label === "" || label.toUpperCase() === "TOTAL") continue;

    const kindRaw = (kindAt === -1 ? "" : (cells[kindAt] ?? "")).toLowerCase();
    const cost = money(costAt === -1 ? undefined : cells[costAt]);
    serial += 1;

    if (kindRaw === "crypto") {
      const symbol = (symbolAt === -1 ? "" : (cells[symbolAt] ?? "")).toUpperCase();
      const entry = TOKEN_CATALOG.find((candidate) => candidate.symbol === symbol);
      if (!entry) {
        skipped.push(`${label}: Vesper does not know the token "${symbol}".`);
        continue;
      }

      const amount = money(quantityAt === -1 ? undefined : cells[quantityAt]);
      if (amount === null || amount < 0) {
        skipped.push(`${label}: quantity is missing or not a number.`);
        continue;
      }

      assets.push({
        id: `im-${Date.now()}-${serial}`,
        class: "defi",
        symbol: entry.symbol,
        label: entry.label,
        amount,
        coingeckoId: entry.coingeckoId,
        ...(cost === null || cost <= 0 ? null : { costBasisUsd: cost }),
      });
      continue;
    }

    const kind = KINDS[kindRaw];
    if (!kind) {
      skipped.push(`${label}: "${cells[kindAt] ?? ""}" is not a kind Vesper recognises.`);
      continue;
    }

    const value = money(valueAt === -1 ? undefined : cells[valueAt]);
    if (value === null) {
      skipped.push(`${label}: value is missing or not a number.`);
      continue;
    }

    assets.push({
      id: `im-${Date.now()}-${serial}`,
      class: "tradfi",
      kind,
      institution: label,
      label,
      // Credit is stored positive and valued negative, so an export
      // that wrote it as a negative has to be turned back.
      balanceUsd: Math.abs(value),
      ...(cost === null || cost <= 0 || kind === "cash" || kind === "credit"
        ? null
        : { costBasisUsd: cost }),
    });
  }

  return { assets, skipped };
}
