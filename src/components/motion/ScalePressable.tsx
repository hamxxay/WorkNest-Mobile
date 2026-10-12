import { useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { haptics, type HapticKind } from "../../utils/haptics";
import { useReduceMotion } from "./useReduceMotion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Press scale of buttons, chips and KPI tiles. */
export const PRESS_SCALE = 0.97;
/** Press scale of large surfaces (cards, full-width list rows): the same feel, fewer pixels of movement. */
export const PRESS_SCALE_LARGE = 0.98;

export type ScalePressableProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  /** Scale while pressed. Default 0.97; 1 turns the effect off. */
  pressScale?: number;
  /** Haptic played when the press is accepted (onPress). Default none. */
  haptic?: HapticKind;
};

/**
 * Pressable that shrinks slightly while pressed and springs back on release (native driver, 60fps).
 * Accepts the same `style` / `children` callbacks as Pressable, so ripple and pressed colours keep working.
 * No scale while the OS "reduce motion" setting is on.
 */
export function ScalePressable({
  style,
  children,
  pressScale = PRESS_SCALE,
  haptic,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: ScalePressableProps) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const springTo = (toValue: number, pressingIn: boolean) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      // In: quick and flat. Out: a touch of bounce.
      speed: pressingIn ? 50 : 22,
      bounciness: pressingIn ? 0 : 5,
    }).start();
  };

  const handlePressIn = (e: GestureResponderEvent) => {
    setPressed(true);
    if (!reduceMotion && pressScale !== 1) springTo(pressScale, true);
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    setPressed(false);
    if (reduceMotion) scale.setValue(1);
    else springTo(1, false);
    onPressOut?.(e);
  };
  const handlePress = onPress
    ? (e: GestureResponderEvent) => {
        if (haptic) haptics.trigger(haptic);
        onPress(e);
      }
    : undefined;

  const state: PressableStateCallbackType = { pressed };
  return (
    <AnimatedPressable
      {...rest}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[typeof style === "function" ? style(state) : style, { transform: [{ scale }] }]}
    >
      {typeof children === "function" ? children(state) : children}
    </AnimatedPressable>
  );
}
