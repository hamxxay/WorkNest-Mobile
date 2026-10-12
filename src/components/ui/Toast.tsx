import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, useTheme } from "../../theme";
import { haptics, type HapticKind } from "../../utils/haptics";
import { useReduceMotion } from "../motion/useReduceMotion";
import { SuccessCheck } from "./SuccessCheck";

export type ToastType = "success" | "error" | "info";

export type ToastOptions = {
  /** Bold first line. */
  title?: string;
  /** ms before it hides. Default 3000 (error 4500). */
  duration?: number;
  /** One text action, e.g. { label: "Undo", onPress }. */
  action?: { label: string; onPress: () => void };
  /**
   * Haptic played with the toast. Default: the error haptic for error toasts, none for success / info.
   * Pass true for the type's own haptic (success -> success), a kind (e.g. "warning"), or false for none.
   */
  haptic?: boolean | HapticKind;
};

export type ToastApi = {
  show: (message: string, type?: ToastType, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  hide: () => void;
};

type ToastItem = { id: number; type: ToastType; message: string } & ToastOptions;

type ToastState = {
  toast: ToastItem | null;
  hide: () => void;
  /** Ids of mounted ToastModalHosts, oldest first. The last one shows the toast. */
  hosts: number[];
  register: (id: number) => void;
  unregister: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const ToastStateContext = createContext<ToastState | null>(null);

/** Without a provider (tests, isolated previews) fall back to the platform toast. */
const fallbackApi: ToastApi = (() => {
  const show = (message: string) => {
    if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
    else if (__DEV__) console.warn("[toast]", message);
  };
  return {
    show,
    success: show,
    error: show,
    info: show,
    hide: () => {},
  };
})();

/**
 * Non-blocking messages. Replace `Alert.alert("Saved")` with `toast.success("Saved")`.
 * Keep Alert / ConfirmDialog for questions that need an answer.
 */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? fallbackApi;
}

type ToastProviderProps = {
  children: ReactNode;
  /** Distance above the bottom safe-area edge, so toasts clear the tab bar. Default 80. */
  bottomOffset?: number;
};

/**
 * Mount once near the root (App.tsx does). Shows one toast at a time; a new toast replaces the current one.
 * While a native Modal that contains a <ToastModalHost/> is open (BottomSheet and ConfirmDialog include one),
 * the toast is drawn inside that Modal so it stays visible above it.
 */
export function ToastProvider({ children, bottomOffset = 80 }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [hosts, setHosts] = useState<number[]>([]);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const hide = useCallback(() => {
    clearTimer();
    setToast(null);
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "info", options: ToastOptions = {}) => {
      if (!message) return;
      idRef.current += 1;
      clearTimer();
      setToast({ id: idRef.current, type, message, ...options });
      timerRef.current = setTimeout(hide, options.duration ?? (type === "error" ? 4500 : 3000));
      const haptic = toastHaptic(type, options.haptic);
      if (haptic) haptics.trigger(haptic);
      AccessibilityInfo.announceForAccessibility(options.title ? `${options.title}. ${message}` : message);
    },
    [hide],
  );

  useEffect(() => clearTimer, []);

  const register = useCallback((id: number) => setHosts(prev => (prev.includes(id) ? prev : [...prev, id])), []);
  const unregister = useCallback((id: number) => setHosts(prev => prev.filter(h => h !== id)), []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, o) => show(m, "success", o),
      error: (m, o) => show(m, "error", o),
      info: (m, o) => show(m, "info", o),
      hide,
    }),
    [show, hide],
  );

  const state = useMemo<ToastState>(
    () => ({ toast, hide, hosts, register, unregister }),
    [toast, hide, hosts, register, unregister],
  );

  return (
    <ToastContext.Provider value={api}>
      <ToastStateContext.Provider value={state}>
        <View style={styles.root}>
          {children}
          {hosts.length === 0 ? <ToastView toast={toast} onHide={hide} placement="bottom" offset={bottomOffset} /> : null}
        </View>
      </ToastStateContext.Provider>
    </ToastContext.Provider>
  );
}

/** Haptic for a toast: errors buzz by default, success / info only when asked. */
function toastHaptic(type: ToastType, option: ToastOptions["haptic"]): HapticKind | null {
  if (option === false) return null;
  if (typeof option === "string") return option;
  if (option === true) return type === "error" ? "error" : type === "success" ? "success" : "light";
  return type === "error" ? "error" : null;
}

let nextHostId = 1;

/**
 * Put this as the LAST child inside your own <Modal> so toasts shown while it is open appear above it.
 * BottomSheet and ConfirmDialog already include one. Inside a modal the toast sits at the top.
 */
export function ToastModalHost({ placement = "top" }: { placement?: "top" | "bottom" }) {
  const state = useContext(ToastStateContext);
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = nextHostId++;
  const register = state?.register;
  const unregister = state?.unregister;

  useEffect(() => {
    if (!register || !unregister) return undefined;
    const id = idRef.current;
    register(id);
    return () => unregister(id);
  }, [register, unregister]);

  if (!state || state.hosts[state.hosts.length - 1] !== idRef.current) return null;
  return <ToastView toast={state.toast} onHide={state.hide} placement={placement} offset={16} />;
}

function ToastView({
  toast,
  onHide,
  placement,
  offset,
}: {
  toast: ToastItem | null;
  onHide: () => void;
  placement: "top" | "bottom";
  offset: number;
}) {
  const { isDark, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<ToastItem | null>(toast);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (toast) {
      setShown(toast);
      if (reduceMotion) {
        anim.setValue(1);
        return;
      }
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      return;
    }
    if (reduceMotion) {
      anim.setValue(0);
      setShown(null);
      return;
    }
    Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setShown(null);
      },
    );
    // reduceMotion is read when a toast comes or goes; changing the setting mid-toast needs no replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, anim]);

  if (!shown) return null;

  const accent =
    shown.type === "success" ? palette.emerald[400] : shown.type === "error" ? palette.red[400] : palette.teal[300];
  const icon = shown.type === "success" ? "checkmark-circle" : shown.type === "error" ? "alert-circle" : "information-circle";
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [placement === "top" ? -24 : 24, 0] });
  const position = placement === "top" ? { top: insets.top + offset } : { bottom: insets.bottom + offset };

  return (
    <View pointerEvents="box-none" style={[styles.host, position]}>
      <Animated.View
        accessibilityRole="alert"
        style={[
          styles.toast,
          isDark ? styles.toastDark : styles.toastLight,
          { opacity: anim, transform: [{ translateY }] },
        ]}
      >
        <Pressable
          onPress={onHide}
          accessibilityRole="button"
          accessibilityLabel={`${shown.title ? `${shown.title}. ` : ""}${shown.message}. Dismiss`}
          style={styles.body}
        >
          {shown.type === "success" ? (
            // Drawn again for every new success toast (key = toast id).
            <SuccessCheck key={shown.id} size={22} color={accent} filled={false} accessibilityLabel={null} />
          ) : (
            <Ionicons name={icon} size={22} color={accent} />
          )}
          <View style={styles.texts}>
            {shown.title ? (
              <Text style={[typography.bodyStrong, styles.light]} numberOfLines={1}>
                {shown.title}
              </Text>
            ) : null}
            <Text style={[typography.bodySmall, styles.light]} numberOfLines={4}>
              {shown.message}
            </Text>
          </View>
        </Pressable>
        {shown.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown.action.label}
            hitSlop={8}
            onPress={() => {
              shown.action?.onPress();
              onHide();
            }}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={[typography.label, styles.actionText]}>{shown.action.label}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  host: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    width: "100%",
    maxWidth: 560,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    minHeight: 52,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastLight: { backgroundColor: palette.slate[800], borderColor: "transparent" },
  toastDark: { backgroundColor: "#243049", borderColor: palette.slate[600] },
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  texts: { flex: 1, gap: 2 },
  light: { color: "#f8fafc" },
  action: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
  actionText: { color: palette.teal[300] },
  pressed: { opacity: 0.7 },
});
