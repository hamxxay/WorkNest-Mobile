import { useEffect, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme, type Tone } from "../../theme";
import { haptics } from "../../utils/haptics";
import { useReduceMotion } from "../motion/useReduceMotion";
import { checkPoints, polylineLength, polylinePath, ringMetrics, strokeWidthFor } from "../motion/successGeometry";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Timings of the drawing (ms): ring, then the tick. */
const RING_MS = 420;
const CHECK_DELAY_MS = 300;
const CHECK_MS = 260;

export type SuccessCheckProps = {
  /** Width and height in dp. Default 64. */
  size?: number;
  /** Colour family. Default "success". */
  tone?: Tone;
  /** Overrides the stroke colour (e.g. on a dark toast). */
  color?: string;
  /** Soft tinted disc behind the mark. Default true. */
  filled?: boolean;
  /** Draw it (default true). false shows the finished mark at once; so does the OS "reduce motion" setting. */
  animate?: boolean;
  /** Wait before drawing (ms). */
  delay?: number;
  /** Play the success haptic as the tick is drawn. Default false (SuccessOverlay turns it on). */
  haptic?: boolean;
  /** Called when the drawing has finished (at once when not animated). */
  onDone?: () => void;
  /** Spoken label. Default "Done". Pass null when the text next to it already says it. */
  accessibilityLabel?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * Animated success mark: a ring draws itself, then a tick, with a small pop (react-native-svg stroke dashes driven
 * by Reanimated on the UI thread). Use it at the moments that deserve it: booking created, agreement signed,
 * door unlocked, request approved, quotation sent. For a full-screen moment use <SuccessOverlay/>.
 */
export function SuccessCheck({
  size = 64,
  tone = "success",
  color,
  filled = true,
  animate = true,
  delay = 0,
  haptic = false,
  onDone,
  accessibilityLabel = "Done",
  style,
}: SuccessCheckProps) {
  const { tones } = useTheme();
  const reduceMotion = useReduceMotion();
  const stroke = color ?? tones[tone].solid;
  const fill = tones[tone].bg;

  const geometry = useMemo(() => {
    const width = strokeWidthFor(size);
    const ring = ringMetrics(size, width);
    const points = checkPoints(size);
    return { width, ring, checkPath: polylinePath(points), checkLength: polylineLength(points) };
  }, [size]);

  const run = animate && !reduceMotion;
  const ringDash = useSharedValue(run ? geometry.ring.circumference : 0);
  const checkDash = useSharedValue(run ? geometry.checkLength : 0);
  const pop = useSharedValue(run ? 0.6 : 1);
  const disc = useSharedValue(run ? 0 : 1);

  useEffect(() => {
    if (!run) {
      ringDash.value = 0;
      checkDash.value = 0;
      pop.value = 1;
      disc.value = 1;
      if (haptic) haptics.success();
      onDone?.();
      return undefined;
    }
    const ease = Easing.out(Easing.cubic);
    pop.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 220, mass: 0.6 }));
    disc.value = withDelay(delay, withTiming(1, { duration: 240 }));
    ringDash.value = withDelay(delay, withTiming(0, { duration: RING_MS, easing: ease }));
    checkDash.value = withDelay(delay + CHECK_DELAY_MS, withTiming(0, { duration: CHECK_MS, easing: ease }));
    const timers = [
      haptic ? setTimeout(() => haptics.success(), delay + CHECK_DELAY_MS) : null,
      onDone ? setTimeout(onDone, delay + CHECK_DELAY_MS + CHECK_MS) : null,
    ];
    return () => timers.forEach((t) => t && clearTimeout(t));
    // Plays once per mount; give it a new `key` to replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ringDash.value }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: checkDash.value }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const discStyle = useAnimatedStyle(() => ({ opacity: disc.value }));

  const { center, radius, circumference } = geometry.ring;
  return (
    <View
      accessible={accessibilityLabel !== null}
      accessibilityRole={accessibilityLabel !== null ? "image" : undefined}
      accessibilityLabel={accessibilityLabel ?? undefined}
      importantForAccessibility={accessibilityLabel === null ? "no-hide-descendants" : undefined}
      style={[{ width: size, height: size }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, popStyle]}>
        {filled ? (
          <Animated.View style={[styles.disc, { borderRadius: size / 2, backgroundColor: fill }, discStyle]} />
        ) : null}
        <Svg width={size} height={size}>
          {/* Start the ring at 12 o'clock. */}
          <G rotation={-90} origin={`${center}, ${center}`}>
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke={stroke}
              strokeWidth={geometry.width}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={ringProps}
            />
          </G>
          <AnimatedPath
            d={geometry.checkPath}
            stroke={stroke}
            strokeWidth={geometry.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${geometry.checkLength} ${geometry.checkLength}`}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
