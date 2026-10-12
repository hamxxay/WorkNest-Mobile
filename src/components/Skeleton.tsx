import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  DimensionValue,
  Easing,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../theme";
import { useReduceMotion } from "./motion/useReduceMotion";

/** Width of the soft highlight that sweeps across the placeholders. */
const BAND = 140;
/** One sweep across the screen, then a short rest. */
const SWEEP_MS = 1150;
const REST_MS = 350;

type Shimmer = { progress: Animated.Value; animated: boolean };

/** One shared sweep for a whole skeleton group, so the highlight crosses every placeholder at the same time. */
const ShimmerContext = createContext<Shimmer | null>(null);

/**
 * Wraps placeholder blocks and drives their shimmer: a soft highlight moving left to right (native driver, no JS
 * work per frame). With the OS "reduce motion" setting on, the blocks stay still.
 */
export function SkeletonGroup({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(REST_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  const shimmer = useMemo(() => ({ progress, animated: !reduceMotion }), [progress, reduceMotion]);
  return (
    <ShimmerContext.Provider value={shimmer}>
      <View style={style} accessibilityLabel="Loading" accessibilityRole="progressbar">
        {children}
      </View>
    </ShimmerContext.Provider>
  );
}

/** A placeholder bar / box in the theme's skeleton colour; shimmers when inside a SkeletonGroup. */
export function SkeletonBlock({
  width = "100%",
  height = 12,
  radius = 6,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const shimmer = useContext(ShimmerContext);
  const animated = !!shimmer?.animated;
  return (
    <View
      style={[styles.block, { width, height, borderRadius: radius, backgroundColor: colors.skeleton }, style]}
    >
      {animated && shimmer ? <ShimmerBand progress={shimmer.progress} /> : null}
    </View>
  );
}

/**
 * The moving highlight inside one block. It is positioned in WINDOW coordinates (the block's own x is measured
 * and subtracted), so the highlight lines up across all blocks like one light passing over the screen.
 */
function ShimmerBand({ progress }: { progress: Animated.Value }) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const ref = useRef<View>(null);
  const [x, setX] = useState(0);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((left) => {
      if (Number.isFinite(left)) setX(Math.round(left));
    });
  }, []);

  const translateX = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [-BAND - x, windowWidth - x] }),
    [progress, windowWidth, x],
  );
  // Light mode: a white sheen on slate-200. Dark mode: a faint lift on the dark placeholder.
  const peak = isDark ? 0.08 : 0.65;

  return (
    <View ref={ref} onLayout={measure} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.band, { transform: [{ translateX }] }]}>
        <Svg width={BAND} height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.white} stopOpacity={0} />
              <Stop offset="0.5" stopColor={colors.white} stopOpacity={peak} />
              <Stop offset="1" stopColor={colors.white} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={BAND} height="100%" fill="url(#shimmer)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export type FadeInViewProps = PropsWithChildren<{
  /** Position in a list: staggers the start (capped, so long lists stay quick). */
  index?: number;
  /** false renders the content in place at once (e.g. rows added after the first load). Default true. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** Stagger step and cap of FadeInView / list entrance. */
export const ENTRANCE_STAGGER_MS = 45;
export const ENTRANCE_MAX_STAGGER = 8;

/**
 * Fades its content in and slides it up 12dp once, on mount; `index` staggers items in a list.
 * Does nothing when `animate` is false or the OS "reduce motion" setting is on.
 */
export function FadeInView({ index = 0, animate = true, children, style }: FadeInViewProps) {
  const reduceMotion = useReduceMotion();
  // Decided once, at mount: a row that was shown without animation never animates later.
  const [run] = useState(() => animate && !reduceMotion);
  const progress = useRef(new Animated.Value(run ? 0 : 1)).current;

  useEffect(() => {
    if (!run) return undefined;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      delay: Math.min(Math.max(index, 0), ENTRANCE_MAX_STAGGER) * ENTRANCE_STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, index, run]);

  if (!run) return style ? <View style={style}>{children}</View> : <>{children}</>;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  block: { overflow: "hidden" },
  band: { position: "absolute", top: 0, bottom: 0, left: 0, width: BAND },
});
