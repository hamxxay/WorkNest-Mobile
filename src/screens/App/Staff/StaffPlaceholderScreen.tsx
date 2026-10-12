import { AppHeader, EmptyState } from "../../../components/ui";
import { StaffScreen } from "./shared/StaffScreen";

/** Stand-in for a staff screen that is not available in the app yet. */
export function makeStaffPlaceholder(title: string) {
  return function StaffPlaceholderScreen() {
    return (
      <StaffScreen>
        <AppHeader title={title} />
        <EmptyState
          icon="construct-outline"
          title="Coming soon"
          message="This screen is being added to the WorkNest staff app. Use the web portal for now."
        />
      </StaffScreen>
    );
  };
}
