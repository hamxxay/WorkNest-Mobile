import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme";
import { useReduceMotion } from "../motion/useReduceMotion";
import { SuccessCheck } from "./SuccessCheck";

export type SuccessOverlayProps = {
  visible: boolean;
  title: string;
  message?: string | null;
  /** ms before it hides by itself. Default 1600 (4000 while a screen reader is on). */
  duration?: number;
  /** Called once after it hides (timer or tap). Navigate, refresh or clear `visible` here. */
  onHidden?: () => void;
};

/**
 * A short, celebratory confirmation for the big moments (agreement signed, request approved, quotation sent):
 * a dimmed screen with a card, the animated SuccessCheck, a title and a message. It plays the success haptic,
 * is announced to screen readers, hides by itself and can be tapped away.
 *
 *   const [done, setDone] = useState<string | null>(null);
 *   ...on success: setDone(result.message);
 *   <SuccessOverlay visible={!!done} title="Quotation sent" message={done} onHidden={() => setDone(null)} />
 */
export function SuccessOverlay({ visible, title, message, duration, onHidden }: SuccessOverlayProps) {
  const { colors, radii, typography, shadows } = useTheme();
  const reduceMotion = useReduceMotion();
  const [screenReader, setScreenReader] = useState(false);
  const hiddenRef = useRef(false);
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  const hide = () => {
    if (hiddenRef.current) return;
    hiddenRef.current = true;
    onHiddenRef.current?.();
  };

  useEffect(() => {
    if (!visible) return undefined;
    hiddenRef.current = false;
    let cancelled = false;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => !cancelled && setScreenReader(!!on))
      .catch(() => {});
    AccessibilityInfo.announceForAccessibility(message ? `${title}. ${message}` : title);
    return () => {
      cancelled = true;
    };
  }, [visible, title, message]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(hide, duration ?? (screenReader ? 4000 : 1600));
    return () => clearTimeout(timer);
  }, [visible, duration, screenReader]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={hide}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={hide}
        accessibilityRole="button"
        accessibilityLabel={`${title}. Close`}
      >
        <View
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radii.sheet }, shadows.lg]}
        >
          {visible ? <SuccessCheck size={72} haptic accessibilityLabel={null} /> : null}
          <Text accessibilityRole="header" style={[typography.heading, styles.center, { color: colors.text }]}>
            {title}
          </Text>
          {message ? (
            <Text style={[typography.bodySmall, styles.center, { color: colors.textSecondary }]} numberOfLines={4}>
              {message}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  card: { width: "100%", maxWidth: 320, alignItems: "center", gap: 10, borderWidth: 1, paddingVertical: 28, paddingHorizontal: 24 },
  center: { textAlign: "center" },
});
