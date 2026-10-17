/**
 * Rasterise the Vesper mark.
 *
 * Run by hand, not in CI: the PNGs it writes are committed, so the build
 * needs no image toolchain and `npm ci` stays small. Re-run it with
 * `npx --yes sharp-cli` available, or after `npm i -D sharp`, whenever
 * scripts/brand/mark.svg changes.
 */

import { readFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync(new URL("./mark.svg", import.meta.url));

const targets = [
  { file: "assets/favicon.png", size: 64 },
  { file: "assets/icon.png", size: 1024 },
  { file: "assets/android-icon-foreground.png", size: 1024 },
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 600 }).resize(size, size).png().toFile(file);
  console.log(`wrote ${file} at ${size}px`);
}
