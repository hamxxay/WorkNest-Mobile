import { useRoute, type RouteProp } from "@react-navigation/native";
import { useAuth } from "../../../context/AuthContext";
import type { AccessOfficerStackParamList } from "../../../navigation/accessOfficerTypes";
import { ViewOnlyProfile } from "../Ceo/ViewOnlyProfile";

type Route = RouteProp<AccessOfficerStackParamList, "AccessOfficerProfile">;

/**
 * Access Officer profile: who is signed in (name and role from the database), the locations a super admin assigned
 * (as the Access screen last loaded them), what the account does, appearance and sign out. Nothing to edit.
 */
export default function AccessOfficerProfileScreen() {
  const { params } = useRoute<Route>();
  const { roleDisplayLabel } = useAuth();
  const names = (params?.locations ?? []).filter((n) => n.trim());
  return (
    <ViewOnlyProfile
      fallbackName={roleDisplayLabel}
      locations={names.length ? names.join(", ") : "Your assigned locations"}
      access="Door access by CNIC"
      accessIcon="key-outline"
      signOutMessage="You will need to sign in again to enrol or remove door access."
    />
  );
}
