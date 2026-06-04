import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, useThemedStyles } from "../theme";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const destructiveColor = "#dc2626";

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      modalBackdrop: {
        flex: 1,
        backgroundColor: colors.overlay,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      },
      modalCard: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: colors.card,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 24,
        gap: 12,
        shadowColor: colors.shadow,
        shadowOpacity: 0.2,
        shadowRadius: 32,
        shadowOffset: { width: 0, height: 16 },
        elevation: 14,
      },
      modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.foreground,
        letterSpacing: -0.3,
      },
      modalMessage: {
        fontSize: 14,
        color: colors.mutedForeground,
        lineHeight: 20,
      },
      modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 8,
      },
      button: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radii.md,
      },
      cancelButton: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.muted,
      },
      cancelText: {
        color: colors.foreground,
        fontSize: 13,
        fontWeight: "700",
      },
      dangerSolidButton: {
        backgroundColor: destructiveColor,
        shadowColor: destructiveColor,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      },
      dangerSolidText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "700",
      },
    }),
  );

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={[styles.button, styles.cancelButton]}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.button, styles.dangerSolidButton]}>
              <Text style={styles.dangerSolidText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
