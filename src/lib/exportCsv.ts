/**
 * Getting your data back out.
 *
 * An app that will not export is an app that owns your numbers rather
 * than holds them, and Vesper's whole argument is the opposite. The
 * figures are yours and they live in your browser; this is the door.
 *
 * Pure on purpose. Handing the file to the browser lives in
 * `download.ts`, because that needs `Platform` from react-native, and
 * importing react-native here made this module unloadable in the plain
 * node process the tests run in.
 */

import type { NetWorth } from "../types";
import { isDeFi } from "../types";

/** RFC 4180 quoting: wrap, and double any quote inside. */
function cell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Every position, valued, with its cost and return. */
export function positionsCsv(netWorth: NetWorth): string {
  const header = [
    "Name",
    "Kind",
    "Symbol",
    "Quantity",
    "Value USD",
    "Cost USD",
    "Gain USD",
    "Gain %",
    "Weight %",
  ];

  const rows = netWorth.valued.map((entry) => {
    // A boolean does not narrow a union, so the asset is pulled apart
    // once here rather than tested three times in the row below.
    const { asset } = entry;
    const kind = isDeFi(asset) ? "Crypto" : asset.kind;
    const symbol = isDeFi(asset) ? asset.symbol : "";
    const quantity = isDeFi(asset) ? asset.amount : "";

    return [
      asset.label,
      kind,
      symbol,
      quantity,
      entry.valueUsd.toFixed(2),
      // Empty rather than 0: an untracked cost is unknown, and writing
      // a zero into a spreadsheet turns it into a claim.
      entry.costUsd === null ? "" : entry.costUsd.toFixed(2),
      entry.gainUsd === null ? "" : entry.gainUsd.toFixed(2),
      entry.gainPct === null ? "" : entry.gainPct.toFixed(2),
      (entry.weight * 100).toFixed(2),
    ];
  });

  const totals = [
    "TOTAL",
    "",
    "",
    "",
    netWorth.totalUsd.toFixed(2),
    netWorth.costUsd.toFixed(2),
    netWorth.gainUsd.toFixed(2),
    netWorth.gainPct.toFixed(2),
    "100.00",
  ];

  return [header, ...rows, totals].map((row) => row.map(cell).join(",")).join("\n");
}
