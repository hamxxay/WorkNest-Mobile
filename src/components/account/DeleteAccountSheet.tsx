import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { AppText, Banner, BottomSheet, Button, Card, Divider, ListRow, TextField, useToast } from "../ui";
import { spacing, useTheme } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../services/authService";
import { errorMessage } from "../../services/apiClient";
import { SALES_EMAIL, SALES_WHATSAPP_NUMBER } from "../../services/tourService";
import {
  deleteEligibility,
  deleteMyAccount,
  DELETED_ITEMS,
  getDeleteCheck,
  isDeleteConfirmed,
  KEPT_ITEMS,
  refusalCheckOf,
  type DeleteCheck,
} from "../../services/account/accountDeletion";
import {
  currentSignInMethods,
  deleteFirebaseUser,
  firebaseAccountMessage,
  reauthenticateWithGoogle,
  reauthenticateWithPassword,
} from "../../services/account/firebaseAccount";
import { INPUT_LIMITS, sanitizeTextForState } from "../../utils/inputSanitizer";

export type DeleteAccountSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** After the account was deleted and this device signed out. `signInRemoved` false: the Firebase sign-in is left. */
  onDeleted: (signInRemoved: boolean) => void;
};

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; check: DeleteCheck };

/**
 * Delete account (customers, Google Play rule). Explains what is deleted and kept, shows whether the account can be
 * deleted (GET /account/delete-check), asks to type DELETE and to confirm who this is (current password, or the Google
 * account again), then: POST /account/delete -> delete the Firebase sign-in -> sign out. If the identity check or the
 * API refuses, nothing is deleted and the sheet says why.
 */
export function DeleteAccountSheet({ visible, onClose, onDeleted }: DeleteAccountSheetProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const { user, clearSession } = useAuth();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const email = typeof user?.email === "string" ? user.email : "";
  // Read when the sheet opens: how this person signs in decides how they confirm who they are.
  const methods = useMemo(() => (visible ? currentSignInMethods() : null), [visible]);
  const usesPassword = !!methods?.password;
  const usesGoogle = !usesPassword && !!methods?.google;

  const loadCheck = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      setLoad({ state: "ready", check: await getDeleteCheck() });
    } catch (error) {
      setLoad({ state: "error", message: errorMessage(error, "Your account details could not be loaded. Please try again.") });
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setConfirmText("");
    setPassword("");
    setFormError(null);
    loadCheck();
  }, [visible, loadCheck]);

  const eligibility = load.state === "ready" ? deleteEligibility(load.check) : null;
  const canDelete = eligibility?.state === "can_delete";
  const ready = canDelete && isDeleteConfirmed(confirmText) && (!usesPassword || password.trim().length > 0);

  const close = () => !busy && onClose();

  const openWhatsApp = async () => {
    const text = encodeURIComponent(`Hello WorkNest, please delete my account.${email ? ` My sign-in email is ${email}.` : ""}`);
    const appUrl = `whatsapp://send?phone=${SALES_WHATSAPP_NUMBER}&text=${text}`;
    const webUrl = `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${text}`;
    try {
      await Linking.openURL((await Linking.canOpenURL(appUrl)) ? appUrl : webUrl);
    } catch {
      toast.error("WhatsApp could not be opened on this device.");
    }
  };

  const openEmail = () => {
    const subject = encodeURIComponent("Delete my WorkNest account");
    const body = encodeURIComponent(`Please delete my WorkNest account.${email ? `\nMy sign-in email: ${email}` : ""}`);
    Linking.openURL(`mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`).catch(() => toast.error("No email app found on this device."));
  };

  const deleteAccount = async () => {
    if (busyRef.current || !ready) return;
    busyRef.current = true;
    setBusy(true);
    setFormError(null);
    try {
      // 1. Who is this? Firebase only deletes a recent sign-in, and nothing is deleted if this fails.
      try {
        if (usesPassword) await reauthenticateWithPassword(password.trim());
        else if (usesGoogle) await reauthenticateWithGoogle();
      } catch (error) {
        setFormError(firebaseAccountMessage(error, "We could not confirm it's you. Nothing was deleted."));
        return;
      }

      // 2. The WorkNest account. A refusal (booking, money due) or failure leaves everything as it was.
      try {
        await deleteMyAccount();
      } catch (error) {
        const check = refusalCheckOf(error);
        if (check) setLoad({ state: "ready", check });
        setFormError(`${errorMessage(error, "Your account could not be deleted. Please try again.")} Nothing was deleted.`);
        return;
      }

      // 3. The sign-in itself, then this device's session (the API token no longer works).
      const signInRemoved = await deleteFirebaseUser();
      await logoutUser().catch(() => undefined);
      await clearSession();
      onDeleted(signInRemoved);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const contactRows = (
    <Card padding={0}>
      <ListRow leftIcon="logo-whatsapp" title="WhatsApp" subtitle="+92 328 0256000" chevron onPress={openWhatsApp} />
      <Divider inset={68} />
      <ListRow leftIcon="mail-outline" title="Email" subtitle={SALES_EMAIL} chevron onPress={openEmail} />
    </Card>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      dismissible={!busy}
      title="Delete account"
      subtitle="Permanently remove your WorkNest account"
      error={formError}
      footer={
        canDelete ? (
          <>
            <Button title="Cancel" variant="outline" style={styles.flex} disabled={busy} onPress={onClose} />
            <Button
              title="Delete account"
              variant="danger"
              leftIcon="trash-outline"
              style={styles.flex}
              loading={busy}
              disabled={!ready || busy}
              onPress={deleteAccount}
            />
          </>
        ) : (
          <Button title="Close" variant="outline" style={styles.flex} onPress={onClose} />
        )
      }
    >
      <View style={styles.body}>
        {load.state === "loading" ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="bodySmall" color="textMuted">
              Checking your account...
            </AppText>
          </View>
        ) : null}

        {load.state === "error" ? (
          <Banner tone="danger" message={load.message} actionLabel="Try again" onAction={loadCheck} />
        ) : null}

        {eligibility && !canDelete ? (
          <>
            <Banner tone={eligibility.state === "blocked" ? "warning" : "info"} message={eligibility.message} />
            {eligibility.state !== "gone" ? (
              <>
                <AppText variant="bodyStrong">Need help? Contact WorkNest</AppText>
                {contactRows}
              </>
            ) : null}
          </>
        ) : null}

        {canDelete ? (
          <>
            <Section title="What is deleted" items={DELETED_ITEMS} />
            <Section title="What is kept" items={KEPT_ITEMS} />
            <AppText variant="bodySmall" color="textSecondary">
              You can sign up again later with the same email, as a new account. This can't be undone.
            </AppText>

            {usesPassword ? (
              <TextField
                label="Current password"
                required
                value={password}
                onChangeText={(v) => setPassword(sanitizeTextForState(v, { maxLength: INPUT_LIMITS.password }))}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="current-password"
                maxLength={INPUT_LIMITS.password}
                helperText="To confirm it's you."
                disabled={busy}
              />
            ) : usesGoogle ? (
              <AppText variant="bodySmall" color="textSecondary">
                To confirm it's you, Google will ask you to choose your account again.
              </AppText>
            ) : null}

            <TextField
              label="Type DELETE to confirm"
              required
              value={confirmText}
              onChangeText={(v) => setConfirmText(v.slice(0, 20))}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              placeholder="DELETE"
              disabled={busy}
            />
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

function Section({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong">{title}</AppText>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <AppText variant="bodySmall" color="textSecondary">
            {"•"}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" style={styles.flex}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: spacing.lg },
  loading: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  section: { gap: spacing.xs },
  bulletRow: { flexDirection: "row", gap: spacing.sm },
});
