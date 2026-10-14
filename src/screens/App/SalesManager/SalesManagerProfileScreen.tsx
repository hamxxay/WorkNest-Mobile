import { useRoute, type RouteProp } from "@react-navigation/native";
import type { SalesManagerStackParamList } from "../../../navigation/salesManagerTypes";
import { ViewOnlyProfile } from "../Ceo/ViewOnlyProfile";

type Route = RouteProp<SalesManagerStackParamList, "SalesManagerProfile">;

/**
 * Sales Manager profile: who is signed in (name and role from the database), the locations a super admin assigned
 * (as the dashboard last listed them), appearance and sign out. Nothing to edit: the Sales Manager app is view only.
 */
export default function SalesManagerProfileScreen() {
  const { params } = useRoute<Route>();
  const names = (params?.locations ?? []).filter((n) => n.trim());
  return (
    <ViewOnlyProfile
      fallbackName="Sales Manager"
      locations={names.length ? names.join(", ") : "Your assigned locations"}
      signOutMessage="You will need to sign in again to see the sales dashboard."
    />
  );
}
