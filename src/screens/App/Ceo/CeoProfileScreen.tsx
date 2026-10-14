import { ViewOnlyProfile } from "./ViewOnlyProfile";

/**
 * CEO profile: who is signed in (name and role from the database), the role (view only, every location),
 * appearance (System / Light / Dark) and sign out. Nothing to edit here: the CEO app is read-only.
 */
export default function CeoProfileScreen() {
  return (
    <ViewOnlyProfile
      fallbackName="CEO"
      locations="All locations"
      signOutMessage="You will need to sign in again to see the CEO dashboard."
    />
  );
}
