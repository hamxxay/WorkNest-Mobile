import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The phone's "Remove animations" / "Reduce motion" accessibility setting, shared by every animated component.
 * Read once, then kept up to date through `reduceMotionChanged`. While it is on, the kit does not animate:
 * press scale, shimmer, list entrance and the success check all show their final state at once.
 */
let reduceMotion = false;
let started = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
  if (value === reduceMotion) return;
  reduceMotion = value;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  try {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => set(!!value))
      .catch(() => {});
    AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => set(!!value));
  } catch {
    // Runtimes without AccessibilityInfo (tests): animations stay on.
  }
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return reduceMotion;
}

/** Latest known value, for code outside React (e.g. before starting an animation in a callback). */
export function isReduceMotionEnabled(): boolean {
  start();
  return reduceMotion;
}

/** true while the user asked the OS for less motion. Re-renders when the setting changes. */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
