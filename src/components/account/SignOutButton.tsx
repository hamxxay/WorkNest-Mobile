import { useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Button, ConfirmDialog, ListRow } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../services/authService";

export type SignOutButtonProps = {
  /** Under "Sign out?": what signing out means for this app. */
  message: string;
  /** "button": a red outlined button (top of a profile, no scrolling needed); "row": a red list row (in a menu card). */
  appearance?: "button" | "row";
  /** Runs after the session is ended (e.g. the customer app resets to its tabs). */
  onSignedOut?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Sign out, asked once ("Sign out?" / "Stay signed in"), the same in every app (customer, staff, CEO, Sales Manager,
 * Access Officer). The Google / Firebase sign-out can fail offline: the session on this phone is ended anyway.
 */
export function SignOutButton({ message, appearance = "button", onSignedOut, style }: SignOutButtonProps) {
  const { clearSession } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logoutUser();
    } catch {
      // Ended locally below.
    } finally {
      await clearSession();
    }
    onSignedOut?.();
  };

  const title = signingOut ? "Signing out..." : "Sign out";
  return (
    <>
      {appearance === "row" ? (
        <ListRow
          leftIcon="log-out-outline"
          leftIconTone="danger"
          title={title}
          destructive
          disabled={signingOut}
          chevron={false}
          onPress={() => setConfirming(true)}
          style={style}
        />
      ) : (
        <Button
          title={title}
          variant="dangerOutline"
          size="sm"
          leftIcon="log-out-outline"
          disabled={signingOut}
          onPress={() => setConfirming(true)}
          style={style}
        />
      )}
      <ConfirmDialog
        visible={confirming}
        title="Sign out?"
        message={message}
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        destructive
        icon="log-out-outline"
        loading={signingOut}
        onCancel={() => setConfirming(false)}
        onConfirm={signOut}
      />
    </>
  );
}
