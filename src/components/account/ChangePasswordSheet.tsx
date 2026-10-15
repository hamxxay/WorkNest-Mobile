import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import { AppText, BottomSheet, Button, TextField, useToast } from "../ui";
import { spacing } from "../../theme";
import { changePassword, firebaseAccountMessage } from "../../services/account/firebaseAccount";
import {
  hasErrors,
  NEW_PASSWORD_HINT,
  validatePasswordChange,
  type PasswordChangeErrors,
} from "../../services/account/passwordChange";
import { INPUT_LIMITS, sanitizeTextForState } from "../../utils/inputSanitizer";

export type ChangePasswordSheetProps = { visible: boolean; onClose: () => void };

/**
 * Change password (email + password accounts): current password, new password (sign-up strength rule) and the new one
 * again. Firebase checks the current password first (re-authentication), then sets the new one.
 */
export function ChangePasswordSheet({ visible, onClose }: ChangePasswordSheetProps) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set synchronously: the keyboard's Done key and the Save button can both fire before `saving` re-renders.
  const savingRef = useRef(false);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
    setFormError(null);
  }, [visible]);

  const clean = (v: string) => sanitizeTextForState(v, { maxLength: INPUT_LIMITS.password });

  const save = async () => {
    if (savingRef.current) return;
    const found = validatePasswordChange({ current, next, confirm });
    setErrors(found);
    setFormError(null);
    if (hasErrors(found)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await changePassword(current.trim(), next.trim());
      toast.success("Use your new password the next time you sign in.", { title: "Password changed" });
      onClose();
    } catch (error) {
      setFormError(firebaseAccountMessage(error, "Your password could not be changed. Please try again."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => !saving && onClose()}
      dismissible={!saving}
      title="Change password"
      subtitle="Enter your current password, then the new one."
      error={formError}
      footer={
        <>
          <Button title="Cancel" variant="outline" style={styles.flex} disabled={saving} onPress={onClose} />
          <Button title="Change password" style={styles.flex} loading={saving} onPress={save} />
        </>
      }
    >
      <View style={styles.fields}>
        <TextField
          label="Current password"
          required
          value={current}
          onChangeText={(v) => {
            setCurrent(clean(v));
            setErrors((e) => ({ ...e, current: undefined }));
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="current-password"
          maxLength={INPUT_LIMITS.password}
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
          error={errors.current}
        />
        <TextField
          ref={nextRef}
          label="New password"
          required
          value={next}
          onChangeText={(v) => {
            setNext(clean(v));
            setErrors((e) => ({ ...e, next: undefined }));
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="new-password"
          maxLength={INPUT_LIMITS.password}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          helperText={NEW_PASSWORD_HINT}
          error={errors.next}
        />
        <TextField
          ref={confirmRef}
          label="Confirm new password"
          required
          value={confirm}
          onChangeText={(v) => {
            setConfirm(clean(v));
            setErrors((e) => ({ ...e, confirm: undefined }));
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="new-password"
          maxLength={INPUT_LIMITS.password}
          returnKeyType="done"
          onSubmitEditing={save}
          error={errors.confirm}
        />
        <AppText variant="caption" color="textMuted">
          Forgot your current password? Sign out and use "Forgot password" on the sign-in screen.
        </AppText>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fields: { gap: spacing.lg },
});
