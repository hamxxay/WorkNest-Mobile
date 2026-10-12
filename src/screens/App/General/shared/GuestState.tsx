import { useNavigation } from "@react-navigation/native";
import type { IllustrationName } from "../../../../components/illustrations";
import { EmptyState } from "../../../../components/ui";

type GuestStateProps = {
  /** Illustration for the tab (preferred over icon). */
  illustration?: IllustrationName;
  /** Ionicons name, used when there is no illustration. */
  icon?: string;
  title: string;
  message: string;
};

/** Shown on customer tabs to signed-out visitors: what the tab is for, and a way to sign in. */
export function GuestState({ illustration, icon, title, message }: GuestStateProps) {
  const navigation = useNavigation<any>();
  return (
    <EmptyState
      illustration={illustration}
      icon={icon}
      title={title}
      message={message}
      actionLabel="Sign in"
      onAction={() => navigation.navigate("Login")}
    />
  );
}
