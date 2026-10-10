import { createContext, PropsWithChildren, useContext, useEffect, useRef } from "react";
import { Animated, DimensionValue, Easing, StyleProp, View, ViewStyle } from "react-native";
import { useThemeColors } from "../theme";

/** One shared pulse for a whole skeleton group, so all placeholders breathe in step. */
const PulseContext = createContext<Animated.AnimatedInterpolation<number> | null>(null);

/** Wraps placeholder blocks and drives their pulse (native driver, no JS work per frame). */
export function SkeletonGroup({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return (
    <PulseContext.Provider value={opacity}>
      <View style={style} accessibilityLabel="Loading" accessibilityRole="progressbar">
        {children}
      </View>
    </PulseContext.Provider>
  );
}

/** A grey placeholder bar / box; pulses when inside a SkeletonGroup. */
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
  const colors = useThemeColors();
  const opacity = useContext(PulseContext) ?? 1;
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.primaryMuted, opacity }, style]}
    />
  );
}

/** Fades and slides its content up once on mount; `index` staggers items in a list. */
export function FadeInView({ index = 0, children, style }: PropsWithChildren<{ index?: number; style?: StyleProp<ViewStyle> }>) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 8) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, index]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
