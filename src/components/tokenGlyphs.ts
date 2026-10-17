/**
 * Token glyphs as single SVG paths, for extrusion.
 *
 * Separate from `coins.tsx`, which draws the flat marks out of several
 * primitives because that is what reads best at 20px. Three.js wants one
 * path string per glyph so `SVGLoader` can turn it into shapes, and
 * trying to serve both from one source would compromise both.
 *
 * All on the same 24 grid as the flat marks, so a glyph that looks
 * centred in 2D is centred in 3D without a second set of numbers.
 */

export const TOKEN_GLYPH_PATH: Record<string, string> = {
  // The B with its four ascenders.
  BTC:
    "M8 4.4h1.5v2.1H8z M10.7 4.4h1.5v2.1h-1.5z " +
    "M8 17.5h1.5v2.1H8z M10.7 17.5h1.5v2.1h-1.5z " +
    "M6.6 6.5h6.2a2.7 2.7 0 0 1 0 5.4H6.6z " +
    "M6.6 12h6.7a2.75 2.75 0 0 1 0 5.5H6.6z",

  // Two stacked bipyramids, the usual reading of the Ethereum mark.
  ETH: "M12 2.5 19 12.6 12 16.6 5 12.6z M12 18.2 19 14.1 12 21.5 5 14.1z",

  // Three slanted bars.
  SOL:
    "M7.6 6.6h9.8l-2.5 2.7H5.1z " +
    "M5.1 10.6h9.8l2.5 2.7H7.6z " +
    "M7.6 14.7h9.8l-2.5 2.7H5.1z",

  // The cube, as a filled hexagon with the three edges cut out.
  LINK:
    "M12 3.4 19 7.5v9L12 20.6 5 16.5v-9z " +
    "M11.4 6.2h1.2v6h-1.2z " +
    "M12.3 12.2l5.2 3-.6 1-5.2-3z " +
    "M11.1 13.2l-5.2 3 .6 1 5.2-3z",

  // A ring of discs, drawn as squares rotated into diamonds so the
  // outline stays a single path the loader can triangulate cleanly.
  ADA:
    "M12 9.6 14.4 12 12 14.4 9.6 12z " +
    "M12 3.8 13.4 5.2 12 6.6 10.6 5.2z " +
    "M12 17.4 13.4 18.8 12 20.2 10.6 18.8z " +
    "M6.2 7.2 7.6 8.6 6.2 10 4.8 8.6z " +
    "M17.8 7.2 19.2 8.6 17.8 10 16.4 8.6z " +
    "M6.2 14 7.6 15.4 6.2 16.8 4.8 15.4z " +
    "M17.8 14 19.2 15.4 17.8 16.8 16.4 15.4z",

  AVAX: "M12 4.6 19.4 18.4H4.6z",

  MATIC: "M12 4.4l5.6 3.2v6.8L12 17.6 6.4 14.4V7.6z M12 8.2 9 9.9v3.4l3 1.7 3-1.7V9.9z",

  DOT: "M12 4.2 15.4 6.4 12 8.6 8.6 6.4z M12 15.4 15.4 17.6 12 19.8 8.6 17.6z",
};

/** Whether we have a glyph worth extruding for this token. */
export const hasGlyph = (symbol: string): boolean => symbol in TOKEN_GLYPH_PATH;
