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

export type ToastType = "success" | "error" | "info";

export type ToastOptions = {
  /** Bold first line. */
  title?: string;
  /** ms before it hides. Default 3000 (error 4500). */
  duration?: number;
  /** One text action, e.g. { label: "Undo", onPress }. */
  action?: { label: string; onPress: () => void };
};

export type ToastApi = {
  show: (message: string, type?: ToastType, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  hide: () => void;
};

type ToastItem = { id: number; type: ToastType; message: string } & ToastOptions;

const ToastContext = createContext<ToastApi | null>(null);

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

/** Mount once near the root (App.tsx does). Shows one toast at a time; a new toast replaces the current one. */
export function ToastProvider({ children, bottomOffset = 80 }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const idRef = useRef(0);

  const hide = useCallback(() => setToast(null), []);
  const show = useCallback((message: string, type: ToastType = "info", options: ToastOptions = {}) => {
    if (!message) return;
    idRef.current += 1;
    setToast({ id: idRef.current, type, message, ...options });
    AccessibilityInfo.announceForAccessibility(options.title ? `${options.title}. ${message}` : message);
  }, []);

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

  return (
    <ToastContext.Provider value={api}>
      <View style={styles.root}>
        {children}
        <ToastHost toast={toast} onHide={hide} bottomOffset={bottomOffset} />
      </View>
    </ToastContext.Provider>
  );
}

function ToastHost({ toast, onHide, bottomOffset }: { toast: ToastItem | null; onHide: () => void; bottomOffset: number }) {
  const { isDark, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<ToastItem | null>(toast);

  useEffect(() => {
    if (toast) {
      setShown(toast);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      const ms = toast.duration ?? (toast.type === "error" ? 4500 : 3000);
      const timer = setTimeout(onHide, ms);
      return () => clearTimeout(timer);
    }
    Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setShown(null);
      },
    );
    return undefined;
  }, [toast, anim, onHide]);

  if (!shown) return null;

  const accent =
    shown.type === "success" ? palette.emerald[400] : shown.type === "error" ? palette.red[400] : palette.teal[300];
  const icon = shown.type === "success" ? "checkmark-circle" : shown.type === "error" ? "alert-circle" : "information-circle";
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + bottomOffset }]}>
      <Animated.View
        accessibilityRole="alert"
        style={[
          styles.toast,
          {
            backgroundColor: isDark ? "#243049" : palette.slate[800],
            borderColor: isDark ? palette.slate[600] : "transparent",
            opacity: anim,
            transform: [{ translateY }],
          },
        ]}
      >
        <Pressable
          onPress={onHide}
          accessibilityRole="button"
          accessibilityLabel={`${shown.title ? `${shown.title}. ` : ""}${shown.message}. Dismiss`}
          style={styles.body}
        >
          <Ionicons name={icon} size={22} color={accent} />
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
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
          >
            <Text style={[typography.label, { color: palette.teal[300] }]}>{shown.action.label}</Text>
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
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  texts: { flex: 1, gap: 2 },
  light: { color: "#f8fafc" },
  action: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
});
