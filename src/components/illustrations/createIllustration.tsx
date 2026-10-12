import type { ReactElement } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../../theme";
import { illustrationPalette, type IllustrationPalette } from "./palette";

/** Default rendered size in dp (the drawings use a 160 x 160 grid). */
export const ILLUSTRATION_SIZE = 140;
/** Side of the square drawing grid every illustration is drawn on. */
export const ILLUSTRATION_GRID = 160;
/** Outline width on the 160 grid (about 2.6dp at the default size). */
export const STROKE = 3;

export type IllustrationProps = {
  /** Width and height in dp. Default 140. */
  size?: number;
  /**
   * Screen-reader description. Leave it out for decorative use (the default): the drawing is then hidden from
   * TalkBack / VoiceOver and the surrounding title and message are read instead.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type IllustrationComponent = ((props: IllustrationProps) => ReactElement) & { displayName?: string };

/** Draws the content of one illustration (everything above the backdrop) with the active palette. */
export type IllustrationDrawing = (p: IllustrationPalette) => ReactElement;

/** Outline props shared by every drawing: ink colour, 3 wide, round caps and joins. */
export function outline(p: IllustrationPalette, color: string = p.ink) {
  return { stroke: color, strokeWidth: STROKE, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
}

/** Four-point sparkle centred on (x, y). */
export function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const d = `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;
  return <Path d={d} fill={fill} />;
}

/** Small decorative dot. */
export function Dot({ x, y, r = 3, fill }: { x: number; y: number; r?: number; fill: string }) {
  return <Circle cx={x} cy={y} r={r} fill={fill} />;
}

/**
 * Turns a drawing into a themed component: a 160-grid Svg with the shared teal backdrop disc, coloured from the
 * active theme and hidden from screen readers unless it is given an accessibilityLabel.
 */
export function createIllustration(displayName: string, draw: IllustrationDrawing): IllustrationComponent {
  function Illustration({ size = ILLUSTRATION_SIZE, accessibilityLabel, style, testID }: IllustrationProps) {
    const { colors, isDark } = useTheme();
    const p = illustrationPalette(colors, isDark);
    const a11y = accessibilityLabel
      ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel }
      : {
          accessible: false,
          accessibilityElementsHidden: true,
          importantForAccessibility: "no-hide-descendants" as const,
        };
    return (
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${ILLUSTRATION_GRID} ${ILLUSTRATION_GRID}`}
        style={style}
        testID={testID}
        pointerEvents="none"
        {...a11y}
      >
        <Circle cx={80} cy={84} r={64} fill={p.backdrop} />
        {draw(p)}
      </Svg>
    );
  }
  Illustration.displayName = displayName;
  return Illustration;
}
