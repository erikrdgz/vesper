/**
 * The icon set.
 *
 * Drawn here on react-native-svg rather than pulled from an icon font.
 * `@expo/vector-icons` would have been one install, but it ships a webfont
 * per family, and the web build would download several hundred glyphs to
 * render fourteen. These are the fourteen.
 *
 * All on a 24 grid with a 1.75 stroke, which is a shade lighter than
 * Feather's 2 and sits better against the type at these sizes.
 */

import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { color } from "../theme";

export interface IconProps {
  size?: number;
  /** Stroke colour. Defaults to secondary text. */
  tone?: string;
  strokeWidth?: number;
}

function Icon({
  size = 20,
  tone = color.textSecondary,
  strokeWidth = 1.75,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tone}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M3 10.5 12 3l9 7.5" />
    <Path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
  </Icon>
);

export const AnalyticsIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M4 20V11" />
    <Path d="M10 20V4" />
    <Path d="M16 20v-6" />
    <Path d="M22 20H2" />
  </Icon>
);

export const CryptoIcon = (props: IconProps) => (
  <Icon {...props}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M9.5 8h4a2.25 2.25 0 0 1 0 4.5h-4" />
    <Path d="M9.5 12.5h4.25a2.25 2.25 0 0 1 0 4.5H9.5" />
    <Path d="M9.5 8v9" />
    <Path d="M11.75 6v2M11.75 17v2" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
);

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 5v14M19 12l-7 7-7-7" />
  </Icon>
);

export const SwapIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M4 8h13l-3.5-3.5" />
    <Path d="M20 16H7l3.5 3.5" />
  </Icon>
);

export const ArrowUpRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M7 17 17 7M8 7h9v9" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M15 5 8 12l7 7" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="m9 5 7 7-7 7" />
  </Icon>
);

export const RefreshIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M20 11a8 8 0 0 0-13.7-5.3L3 9" />
    <Path d="M3 4v5h5" />
    <Path d="M4 13a8 8 0 0 0 13.7 5.3L21 15" />
    <Path d="M21 20v-5h-5" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M3.5 6h17" />
    <Path d="M8.5 6V4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V6" />
    <Path d="M6.5 6.5 7.5 20a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13.5" />
  </Icon>
);

export const WalletIcon = (props: IconProps) => (
  <Icon {...props}>
    <Rect x="3" y="6" width="18" height="14" rx="2.5" />
    <Path d="M3 10h18" />
    <Circle cx="17" cy="15" r="1.2" />
  </Icon>
);
