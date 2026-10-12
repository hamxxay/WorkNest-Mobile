import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/**
 * True while the phone asks for less motion (Android "Remove animations", iOS "Reduce Motion").
 *
 * Starts from Reanimated's launch-time value (so the first frame is already right) and re-renders when the user
 * changes the setting while the app is open. Use it to swap movement for an instant change: native-stack
 * `animation: "none"`, bottom-tab `animation: "none"`, or setting a shared value without `withSpring`.
 */
export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  const [reduce, setReduce] = useState(atLaunch);

  useEffect(() => {
    let active = true;
    AccessibilityInfo?.isReduceMotionEnabled?.()
      .then((value) => {
        if (active) setReduce(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo?.addEventListener?.("reduceMotionChanged", (value) => {
      if (active) setReduce(value);
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return reduce;
}
