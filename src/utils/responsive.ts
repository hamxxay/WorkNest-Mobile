import { useWindowDimensions } from "react-native";

/** Breakpoints for phones, large phones and tablets (in dp). */
export const BREAKPOINTS = { small: 360, tablet: 700 } as const;
/** Widest the main content column gets on tablets / unfolded foldables. */
export const MAX_CONTENT_WIDTH = 720;

/**
 * Current window size and layout hints. Uses useWindowDimensions, so it updates on rotation, split screen and
 * foldables (a module-level Dimensions.get() is read once and goes stale).
 */
export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const isSmall = width < BREAKPOINTS.small;
  const isTablet = width >= BREAKPOINTS.tablet;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  return {
    width,
    height,
    fontScale,
    isSmall,
    isTablet,
    isLandscape: width > height,
    /** Width available to the content column (capped on tablets). */
    contentWidth,
    /** Columns for card grids: 1 on small phones, 2 on phones, 3 on tablets. */
    gridColumns: isTablet ? 3 : isSmall ? 1 : 2,
    /** A size that grows a little on bigger screens: scale(16) ≈ 16 on a 390-wide phone. */
    scale: (size: number) => Math.round(size * Math.min(Math.max(contentWidth / 390, 0.88), 1.2)),
  };
}
