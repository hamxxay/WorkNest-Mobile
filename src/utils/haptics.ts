/**
 * Haptic feedback: subtle, optional, never required to understand what happened.
 *
 *   import { haptics } from "../utils/haptics";
 *   haptics.light();      // a primary action was pressed (only where it means something, not on every tap)
 *   haptics.medium();     // a physical action starts (Unlock door)
 *   haptics.selection();  // a segmented control / filter chip changed
 *   haptics.success();    // booking created, agreement signed, door unlocked, request approved
 *   haptics.warning();    // the user has to fix something first
 *   haptics.error();      // something failed (toast.error does this for you)
 *
 * Uses react-native-haptic-feedback when its native module is present and silently does nothing otherwise
 * (unit tests, or an app binary built before the package was added). Android's own vibration / touch feedback
 * setting is respected, and the user can switch app haptics off in Profile (saved on the device).
 */

export type HapticKind =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

/** react-native-haptic-feedback type for each kind. */
export const HAPTIC_TYPES: Readonly<Record<HapticKind, string>> = {
  selection: "selection",
  light: "impactLight",
  medium: "impactMedium",
  heavy: "impactHeavy",
  success: "notificationSuccess",
  warning: "notificationWarning",
  error: "notificationError",
};

export const HAPTICS_STORAGE_KEY = "@worknest/haptics-enabled";

/**
 * Two taps / ticks closer than this are one gesture (e.g. a chip press that also changes a filter): play the first.
 * Outcomes (success / warning / error) always play, even right after a tap (a form that fails validation at once).
 */
const MIN_GAP_MS = 60;
const OUTCOMES: ReadonlySet<HapticKind> = new Set<HapticKind>(["success", "warning", "error"]);

const TRIGGER_OPTIONS = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
};

type Engine = {
  trigger: (type: string, options?: typeof TRIGGER_OPTIONS) => void;
};
type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let engine: Engine | null | undefined; // undefined: not looked up yet; null: not available
let enabled = true;
let changedByUser = false;
let lastAt = -Infinity;
const listeners = new Set<() => void>();

function loadEngine(): Engine | null {
  if (engine !== undefined) return engine;
  try {
    // Required lazily: the package looks its native module up when it is imported and throws when it is missing.
    const mod = require("react-native-haptic-feedback");
    const candidate = mod?.default ?? mod;
    engine =
      candidate && typeof candidate.trigger === "function"
        ? (candidate as Engine)
        : null;
  } catch {
    engine = null;
  }
  return engine;
}

function loadStorage(): Storage | null {
  try {
    const mod = require("@react-native-async-storage/async-storage");
    const storage = mod?.default ?? mod;
    return storage && typeof storage.getItem === "function"
      ? (storage as Storage)
      : null;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach(listener => listener());
}

/** Plays one haptic. Safe to call anywhere: a no-op when haptics are off or unavailable. */
export function triggerHaptic(kind: HapticKind): void {
  if (!enabled) return;
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS && !OUTCOMES.has(kind)) return;
  const e = loadEngine();
  if (!e) return;
  lastAt = now;
  try {
    e.trigger(HAPTIC_TYPES[kind], TRIGGER_OPTIONS);
  } catch {
    // A haptic is never worth an error.
  }
}

export const haptics = {
  selection: () => triggerHaptic("selection"),
  light: () => triggerHaptic("light"),
  medium: () => triggerHaptic("medium"),
  heavy: () => triggerHaptic("heavy"),
  success: () => triggerHaptic("success"),
  warning: () => triggerHaptic("warning"),
  error: () => triggerHaptic("error"),
  trigger: triggerHaptic,
};

/** Whether app haptics are on (the user's choice; Android's system setting is applied on top). */
export function isHapticsEnabled(): boolean {
  return enabled;
}

/** Turns app haptics on or off and saves the choice on the device. */
export function setHapticsEnabled(value: boolean): void {
  changedByUser = true;
  if (enabled === value) return;
  enabled = value;
  emit();
  loadStorage()
    ?.setItem(HAPTICS_STORAGE_KEY, value ? "1" : "0")
    .catch(() => {});
}

/** For useSyncExternalStore: called when the preference changes. */
export function subscribeHaptics(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads the saved preference (runs once when this module is first imported). */
export function loadHapticsPreference(): Promise<boolean> {
  const storage = loadStorage();
  if (!storage) return Promise.resolve(enabled);
  return storage
    .getItem(HAPTICS_STORAGE_KEY)
    .then(saved => {
      // A choice made while the read was in flight wins.
      if (changedByUser) return;
      const next = saved === "0" ? false : saved === "1" ? true : enabled;
      if (next !== enabled) {
        enabled = next;
        emit();
      }
    })
    .catch(() => {})
    .then(() => enabled);
}

loadHapticsPreference();
