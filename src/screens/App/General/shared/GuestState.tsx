import { useNavigation } from "@react-navigation/native";
import type { IllustrationName } from "../../../../components/illustrations";
import { EmptyState } from "../../../../components/ui";
import { ScrollableState } from "./ScrollableState";

type GuestStateProps = {
  /** Illustration for the tab (preferred over icon). */
  illustration?: IllustrationName;
  /** Ionicons name, used when there is no illustration. */
  icon?: string;
  title: string;
  message: string;
};

/**
 * Shown on customer tabs to signed-out visitors: what the tab is for, and a way to sign in. Scrolls when the window
 * is too short for it (landscape, large text), so the Sign in button is always reachable.
 */
export function GuestState({ illustration, icon, title, message }: GuestStateProps) {
  const navigation = useNavigation<any>();
  return (
    <ScrollableState>
      <EmptyState
        illustration={illustration}
        icon={icon}
        title={title}
        message={message}
        actionLabel="Sign in"
        onAction={() => navigation.navigate("Login")}
      />
    </ScrollableState>
  );
}
