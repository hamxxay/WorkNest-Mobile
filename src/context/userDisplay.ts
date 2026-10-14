import { normalizeRoleName, roleLabel, type UserRole } from "./roles";

// How the signed-in user's name and role are shown (headers, greetings, profile). Pure (no React), unit-tested in
// userDisplay.test.ts.
//
// Both come from the database through GET auth/me (authService.triggerBackgroundSync stores them):
//   - name:            WN_Users.Name, shown as it is ("CEO1" stays "CEO1": no digits stripped, no case change).
//   - roleDisplayName: WN_Roles.DisplayName ("CEO", "Sales Manager"), shown as the role label.
// Fallbacks only when a field is missing: the email prefix for the name (the one place trailing digits are
// stripped, as the CMS does: "ceo1@x" -> "Ceo"), and the app's own role label (roles.ts roleLabel).

/** The stored-user fields these helpers read (StoredUser is a superset). */
export type DisplaySource = { name?: unknown; email?: unknown; roleDisplayName?: unknown } | null | undefined;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The name from auth/me (WN_Users.Name), trimmed, otherwise as it is; "" when there is none. */
export function realName(user: DisplaySource): string {
  return text(user?.name);
}

/** A name made from an email: its first word before "@", trailing digits removed, capitalised ("ceo1@x" -> "Ceo"). */
export function emailPrefixName(email: unknown): string {
  const prefix = text(email).split("@")[0] ?? "";
  const raw = prefix.split(/[\s._-]+/)[0] ?? "";
  const first = raw.replace(/\d+$/, "") || raw;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

/** The name to show in full: the real name as it is, else the email prefix, else `fallback`. */
export function userDisplayName(user: DisplaySource, fallback = ""): string {
  return realName(user) || emailPrefixName(user?.email) || fallback;
}

/** The name in a greeting: the first word of the real name as it is ("CEO1"; "Sara" of "Sara Khan"), else the email prefix. */
export function greetingName(user: DisplaySource): string {
  const name = realName(user);
  if (name) return name.split(/\s+/)[0];
  return emailPrefixName(user?.email);
}

/**
 * The role to show: WN_Roles.DisplayName from auth/me, unless it names a different role than the one the app is
 * showing (a role that changed since auth/me last answered); otherwise the app's label for `role`.
 */
export function userRoleLabel(user: DisplaySource, role: UserRole): string {
  const display = text(user?.roleDisplayName);
  if (display) {
    const named = normalizeRoleName(display);
    if (!named || named === role) return display;
  }
  return roleLabel(role);
}
