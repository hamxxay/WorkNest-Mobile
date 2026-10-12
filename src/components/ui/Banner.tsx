import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";

export type BannerTone = "info" | "success" | "warning" | "danger";

export type BannerProps = {
  /** Default "info". */
  tone?: BannerTone;
  title?: string;
  message: string;
  /** Ionicons name. Default depends on the tone. */
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Shows an x button. */
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
};

const ICONS: Record<BannerTone, string> = {
  info: "information-circle",
  success: "checkmark-circle",
  warning: "warning",
  danger: "alert-circle",
};

/**
 * Inline message that stays on screen (form result, "reset email sent", "you are offline").
 * Use useToast() for short-lived notices instead.
 */
export function Banner({ tone = "info", title, message, icon, actionLabel, onAction, onDismiss, style }: BannerProps) {
  const { tones, colors, typography } = useTheme();
  const t = tones[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }, style]}
    >
      <Ionicons name={icon ?? ICONS[tone]} size={20} color={t.fg} style={styles.icon} />
      <View style={styles.texts}>
        {title ? <Text style={[typography.bodyStrong, { color: t.fg }]}>{title}</Text> : null}
        <Text style={[typography.bodySmall, { color: colors.text }]}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            hitSlop={10}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={[typography.label, { color: t.fg }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          hitSlop={10}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  icon: { marginTop: 1 },
  texts: { flex: 1, gap: 2 },
  action: { alignSelf: "flex-start", marginTop: 6, minHeight: 28, justifyContent: "center" },
  close: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginTop: -4, marginRight: -4 },
  pressed: { opacity: 0.6 },
});
