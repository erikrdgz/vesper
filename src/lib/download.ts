/**
 * Handing a generated file to the browser.
 *
 * Separate from the code that builds the file, which is pure and
 * testable. This half needs `Platform` and the DOM, and keeping them
 * apart is what lets the CSV round-trip be covered by tests that run in
 * a plain node process.
 */

import { Platform } from "react-native";

/**
 * Hand the file to the browser.
 *
 * Web only, and it says so rather than pretending: a native build would
 * need the share sheet, which is a different mechanism and not one this
 * build has a reason to carry.
 */
export function downloadCsv(filename: string, content: string): boolean {
  if (Platform.OS !== "web") return false;

  try {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking immediately races the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask the browser for a CSV and hand back its text.
 *
 * Resolves with null when the person cancels, which is not an error and
 * must not be reported as one. Web only: a native build would use the
 * document picker, which this build has no reason to carry.
 */
export function pickCsv(): Promise<string | null> {
  if (Platform.OS !== "web") return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,text/csv";

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);

        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };

      // A cancelled picker fires no event in most browsers, so nothing
      // here resolves on cancel. The promise is simply dropped, which
      // is fine: it holds a closure and no timer.
      input.click();
    } catch {
      resolve(null);
    }
  });
}
