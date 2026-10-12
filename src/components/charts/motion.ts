import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, type LayoutChangeEvent } from "react-native";
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

// Reduce motion (Android "Remove animations", iOS "Reduce Motion"), read with AccessibilityInfo and cached for the
// whole app so a chart mounted later knows the answer on its first render.
let reduceMotionCache: boolean | null = null;
let reduceMotionRequest: Promise<boolean> | null = null;

function readReduceMotion(): Promise<boolean> {
  if (reduceMotionCache !== null) return Promise.resolve(reduceMotionCache);
  if (!reduceMotionRequest) {
    reduceMotionRequest = Promise.resolve()
      .then(() => AccessibilityInfo.isReduceMotionEnabled())
      .then(value => (reduceMotionCache = !!value))
      .catch(() => (reduceMotionCache = false));
  }
  return reduceMotionRequest;
}

/** The system reduce-motion setting; null until it has been read (only on the very first use). */
export function useReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(reduceMotionCache);
  useEffect(() => {
    let alive = true;
    readReduceMotion().then(value => alive && setReduce(value));
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (value: boolean) => {
      reduceMotionCache = !!value;
      if (alive) setReduce(!!value);
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

export type MountProgressOptions = {
  /** Start only once this is true (e.g. after the first layout gave the chart its width). Default true. */
  ready?: boolean;
  /** Milliseconds. Default 650. */
  duration?: number;
  /** Milliseconds before starting. Default 0. */
  delay?: number;
};

/**
 * A shared value that runs 0 -> 1 once, when the chart first appears (ease-out). With reduce motion on it is
 * set straight to 1: the chart is drawn complete, with no mount animation.
 */
export function useMountProgress({ ready = true, duration = 650, delay = 0 }: MountProgressOptions = {}): SharedValue<number> {
  const reduce = useReduceMotion();
  const progress = useSharedValue(reduce === true ? 1 : 0);
  const started = useRef(false);

  useEffect(() => {
    if (reduce === null) return;
    if (reduce) {
      // Also covers the setting being switched on mid-animation.
      cancelAnimation(progress);
      progress.value = 1;
      started.current = true;
      return;
    }
    if (started.current || !ready) return;
    started.current = true;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
    );
  }, [reduce, ready, duration, delay, progress]);

  return progress;
}

/** Width of a view from its layout (0 until the first layout). Re-renders only when the width changes. */
export function useLayoutWidth(): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth(prev => (prev === next ? prev : next));
  }, []);
  return [width, onLayout];
}
