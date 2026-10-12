import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { Button } from "./Button";
import { ToastModalHost } from "./Toast";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Red confirm button and warning icon (delete, cancel booking, log out). */
  destructive?: boolean;
  /** Confirm button spinner; also blocks closing. */
  loading?: boolean;
  /** Ionicons name shown above the title. Default: alert icon when destructive, none otherwise. */
  icon?: string;
  /** Extra content between message and buttons (e.g. a reason TextField). */
  children?: ReactNode;
};

/** Centred confirmation dialog. Use for blocking yes/no decisions; use useToast() for plain messages. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
  loading = false,
  icon,
  children,
}: ConfirmDialogProps) {
  const { colors, radii, typography, shadows } = useTheme();
  const iconName = icon ?? (destructive ? "warning-outline" : undefined);
  const cancel = () => {
    if (!loading) onCancel();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={cancel} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel={cancelLabel} accessibilityRole="button" />
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceRaised,
              borderRadius: radii.sheet,
              borderColor: colors.border,
            },
            shadows.lg,
          ]}
        >
          {iconName ? (
            <View style={[styles.iconWell, { backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft }]}>
              <Ionicons name={iconName} size={24} color={destructive ? colors.danger : colors.onPrimarySoft} />
            </View>
          ) : null}
          <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
            {title}
          </Text>
          {message ? <Text style={[typography.body, { color: colors.textSecondary }]}>{message}</Text> : null}
          {children}
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="outline" onPress={cancel} disabled={loading} style={styles.flex} />
            <Button
              title={confirmLabel}
              variant={destructive ? "danger" : "primary"}
              onPress={onConfirm}
              loading={loading}
              style={styles.flex}
            />
          </View>
        </View>
        <ToastModalHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, borderWidth: 1, padding: 20, gap: 10 },
  iconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  flex: { flex: 1 },
});
