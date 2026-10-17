/**
 * Two things `expo export` does not do for a static host.
 *
 * 1. The generated shell has no background colour, so a dark app flashes
 *    white for however long the 700KB bundle takes to parse. On a slow
 *    connection that is not a flash, it is a second of white.
 * 2. GitHub Pages serves its own 404 for any path that is not a file.
 *    This is a single-page bundle, so the 404 has to be the app.
 *
 * Both are cheap to fix here and awkward to fix anywhere else without
 * pulling in expo-router for its `+html` template.
 */

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const GROUND = "#0B0E14";

const indexPath = join(DIST, "index.html");
let html = readFileSync(indexPath, "utf8");

if (!html.includes("data-vesper-shell")) {
  const style =
    `<style data-vesper-shell>` +
    `html,body,#root{background-color:${GROUND};color-scheme:dark;}` +
    `body{margin:0;}` +
    `</style>`;

  if (!html.includes("</head>")) {
    throw new Error("Exported index.html has no </head>; the shell template changed.");
  }

  html = html.replace("</head>", `${style}</head>`);
  writeFileSync(indexPath, html);
}

copyFileSync(indexPath, join(DIST, "404.html"));

console.log(`finish-export: shell background ${GROUND}, 404.html written`);
