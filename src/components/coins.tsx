/**
 * Token marks.
 *
 * Drawn here rather than fetched, for the same reason the rest of the
 * iconography is: a static app that reaches out to a CDN for eight small
 * images has a worse first paint, a dependency it does not control, and
 * one more thing that can be wrong in a screenshot a year from now.
 *
 * These are the tokens' own identifying marks, used to identify the
 * tokens. Each sits on a disc of its own brand colour so the row scans by
 * colour before it scans by shape.
 */

import Svg, { Circle, Ellipse, Path, Polygon } from "react-native-svg";
import { View } from "react-native";

import { tokenColor } from "./TokenObject";

interface CoinProps {
  symbol: string;
  size?: number;
}

/** Glyphs on a 24 grid, drawn in the ink colour over the token's disc. */
function Glyph({ symbol, ink }: { symbol: string; ink: string }) {
  switch (symbol) {
    case "BTC":
      return (
        <>
          <Path
            d="M9 6.5h4.4a2.6 2.6 0 0 1 0 5.2H9zM9 11.7h4.9a2.65 2.65 0 0 1 0 5.3H9z"
            fill={ink}
          />
          <Path d="M8 6.5h1.6v10.5H8z" fill={ink} />
          <Path d="M10.6 4.4h1.3v2.3h-1.3zM13.2 4.4h1.3v2.3h-1.3z" fill={ink} />
          <Path d="M10.6 16.8h1.3v2.3h-1.3zM13.2 16.8h1.3v2.3h-1.3z" fill={ink} />
        </>
      );

    case "ETH":
      return (
        <>
          <Polygon points="12,3.5 12,10.2 17.6,12.8" fill={ink} fillOpacity={0.65} />
          <Polygon points="12,3.5 6.4,12.8 12,10.2" fill={ink} />
          <Polygon points="12,14.1 12,20.5 17.6,14" fill={ink} fillOpacity={0.65} />
          <Polygon points="12,20.5 12,14.1 6.4,14" fill={ink} />
        </>
      );

    case "SOL":
      // Three slanted bars, the parallelogram set.
      return (
        <>
          <Path d="M7.6 7.2h9.6l-2.4 2.6H5.2z" fill={ink} />
          <Path d="M5.2 11.1h9.6l2.4 2.6H7.6z" fill={ink} fillOpacity={0.78} />
          <Path d="M7.6 15h9.6l-2.4 2.6H5.2z" fill={ink} />
        </>
      );

    case "LINK":
      // The cube in outline, seen corner-on.
      return (
        <>
          <Polygon
            points="12,4 18.5,7.8 18.5,16.2 12,20 5.5,16.2 5.5,7.8"
            fill="none"
            stroke={ink}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path d="M12 4v8M12 12l6.5 4.2M12 12 5.5 16.2" stroke={ink} strokeWidth={1.6} />
        </>
      );

    case "ADA":
      // The constellation of discs.
      return (
        <>
          <Circle cx="12" cy="12" r="2.1" fill={ink} />
          <Circle cx="12" cy="5.6" r="1.3" fill={ink} />
          <Circle cx="12" cy="18.4" r="1.3" fill={ink} />
          <Circle cx="6.5" cy="8.8" r="1.3" fill={ink} />
          <Circle cx="17.5" cy="8.8" r="1.3" fill={ink} />
          <Circle cx="6.5" cy="15.2" r="1.3" fill={ink} />
          <Circle cx="17.5" cy="15.2" r="1.3" fill={ink} />
        </>
      );

    case "DOT":
      return (
        <>
          <Ellipse cx="12" cy="6.4" rx="3.4" ry="2.3" fill={ink} />
          <Ellipse cx="12" cy="17.6" rx="3.4" ry="2.3" fill={ink} />
          <Circle cx="7.2" cy="9.6" r="1.7" fill={ink} fillOpacity={0.8} />
          <Circle cx="16.8" cy="14.4" r="1.7" fill={ink} fillOpacity={0.8} />
        </>
      );

    case "AVAX":
      return (
        <>
          <Path d="M12 5.2 19 18H5z" fill={ink} />
          <Path d="M14.9 18h3.1l-1.6-2.8z" fill={ink} fillOpacity={0.6} />
        </>
      );

    case "MATIC":
      return (
        <Path
          d="M15.6 9.1 12 7l-3.6 2.1v4.2L12 15.4l3.6-2.1V11l1.8-1v4.3L12 17.5l-5.4-3.1V8.1L12 5l5.4 3.1z"
          fill={ink}
        />
      );

    default:
      return <Circle cx="12" cy="12" r="4" fill={ink} />;
  }
}

/**
 * A token's mark on its own disc.
 *
 * The ink is near-black rather than white: every one of these brand
 * colours is mid-to-light, and white on them fails contrast badly.
 */
export function CoinMark({ symbol, size = 24 }: CoinProps) {
  const tone = tokenColor(symbol);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="12" fill={tone} />
        <Glyph symbol={symbol} ink="#0B0E14" />
      </Svg>
    </View>
  );
}

/** The glyph alone, in a given colour. For dense rows where a disc is loud. */
export function CoinGlyph({ symbol, size = 20, tone }: CoinProps & { tone?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Glyph symbol={symbol} ink={tone ?? tokenColor(symbol)} />
    </Svg>
  );
}
