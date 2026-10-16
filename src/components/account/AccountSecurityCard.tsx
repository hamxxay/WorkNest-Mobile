import { useMemo, useState } from "react";
import { Card, Divider, ListRow } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { canSelfDelete, STAFF_DELETE_MESSAGE } from "../../services/account/accountDeletion";
import { currentSignInMethods } from "../../services/account/firebaseAccount";
import { ChangePasswordSheet } from "./ChangePasswordSheet";
import { DeleteAccountSheet } from "./DeleteAccountSheet";
import { useResponsive } from "../../utils/responsive";

export type AccountSecurityCardProps = {
  /** After a customer deleted their account (this device is signed out by then). */
  onDeleted?: (signInRemoved: boolean) => void;
};

/**
 * Profile > account rows: "Change password" (email + password sign-ins only; hidden for Google-only accounts) and
 * "Delete account": customers (role "general") delete their own account in a sheet; staff, CEO, Sales Manager and
 * Access Officer accounts see "Ask a WorkNest admin to remove your account".
 */
export function AccountSecurityCard({ onDeleted }: AccountSecurityCardProps) {
  const { user, role } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Recomputed when the signed-in user changes (Firebase's current user is read synchronously).
  const methods = useMemo(() => currentSignInMethods(), [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const customer = canSelfDelete(role);
  // With large text the row subtitles get more lines instead of being cut off.
  const { isLargeText } = useResponsive();
  const subtitleLines = isLargeText ? 4 : 2;

  if (!user) return null;

  return (
    <>
      <Card padding={0}>
        {methods.password ? (
          <>
            <ListRow
              leftIcon="key-outline"
              title="Change password"
              subtitle="Update the password you sign in with"
              subtitleLines={subtitleLines}
              chevron
              onPress={() => setPasswordOpen(true)}
            />
            <Divider inset={68} />
          </>
        ) : null}
        {customer ? (
          <ListRow
            leftIcon="trash-outline"
            leftIconTone="danger"
            title="Delete account"
            subtitle="Remove your account and personal details"
            subtitleLines={subtitleLines}
            destructive
            chevron
            onPress={() => setDeleteOpen(true)}
          />
        ) : (
          <ListRow
            leftIcon="person-remove-outline"
            leftIconTone="neutral"
            title="Delete account"
            subtitle={STAFF_DELETE_MESSAGE}
            subtitleLines={isLargeText ? 6 : 3}
            chevron={false}
          />
        )}
      </Card>

      {methods.password ? <ChangePasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} /> : null}
      {customer ? (
        <DeleteAccountSheet
          visible={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={(removed) => {
            setDeleteOpen(false);
            onDeleted?.(removed);
          }}
        />
      ) : null}
    </>
  );
}
