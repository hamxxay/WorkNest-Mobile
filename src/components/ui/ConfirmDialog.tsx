import { useEffect, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { haptics } from "../../utils/haptics";
import { stackActions } from "../../utils/responsive";
import { Banner } from "./Banner";
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
  /** Error shown inside the dialog above the buttons (e.g. the action failed); keep the dialog open to retry. */
  error?: string | null | false;
};

/**
 * Centred confirmation dialog. Use for blocking yes/no decisions; use useToast() for plain messages.
 * The confirm button plays a light haptic; an `error` shown inside plays the error haptic.
 */
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
  error,
}: ConfirmDialogProps) {
  const { colors, radii, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  // Fits any window: the card is never taller than the space left (its text scrolls; the buttons stay visible,
  // above the keyboard too), and the two buttons go one above the other when side by side they would be too
  // narrow for their labels (320dp phone, Fold cover screen, large text).
  const cardWidth = Math.min(width - 2 * BACKDROP_PADDING - insets.left - insets.right, CARD_MAX_WIDTH);
  const stacked = stackActions(cardWidth - 2 * CARD_PADDING, fontScale, [cancelLabel, confirmLabel], ACTIONS_GAP);
  const iconName = icon ?? (destructive ? "warning-outline" : undefined);
  // A failure shown inside the dialog buzzes like an error toast would.
  useEffect(() => {
    if (visible && error) haptics.error();
  }, [visible, error]);
  const cancel = () => {
    if (!loading) onCancel();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={cancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView style={[styles.fill, { backgroundColor: colors.overlay }]} behavior="padding">
        <View
          style={[
            styles.backdrop,
            {
              paddingTop: insets.top + BACKDROP_PADDING,
              paddingBottom: insets.bottom + BACKDROP_PADDING,
              paddingLeft: insets.left + BACKDROP_PADDING,
              paddingRight: insets.right + BACKDROP_PADDING,
            },
          ]}
        >
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
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
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
              {error ? <Banner tone="danger" message={error} /> : null}
            </ScrollView>
            {/* Stacked: the confirm button on top (column-reverse keeps Cancel first for screen readers). */}
            <View style={[styles.actions, stacked && styles.actionsStacked]}>
              <Button title={cancelLabel} variant="outline" onPress={cancel} disabled={loading} style={stacked ? null : styles.flex} />
              <Button
                title={confirmLabel}
                variant={destructive ? "danger" : "primary"}
                haptic
                onPress={onConfirm}
                loading={loading}
                style={stacked ? null : styles.flex}
              />
            </View>
          </View>
          <ToastModalHost />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const BACKDROP_PADDING = 24;
const CARD_MAX_WIDTH = 380;
const CARD_PADDING = 20;
const ACTIONS_GAP = 10;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { width: "100%", maxWidth: CARD_MAX_WIDTH, maxHeight: "100%", borderWidth: 1, padding: CARD_PADDING, gap: 10 },
  // The text part shrinks (and scrolls) first when the card reaches its max height.
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: 10 },
  iconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  actions: { flexDirection: "row", gap: ACTIONS_GAP, marginTop: 10 },
  actionsStacked: { flexDirection: "column-reverse", alignItems: "stretch" },
  flex: { flex: 1 },
});
