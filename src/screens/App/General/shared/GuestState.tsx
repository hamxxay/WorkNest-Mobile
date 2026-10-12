import { useNavigation } from "@react-navigation/native";
import { EmptyState } from "../../../../components/ui";

/** Shown on customer tabs to signed-out visitors: what the tab is for, and a way to sign in. */
export function GuestState({ icon, title, message }: { icon: string; title: string; message: string }) {
  const navigation = useNavigation<any>();
  return (
    <EmptyState
      icon={icon}
      title={title}
      message={message}
      actionLabel="Sign in"
      onAction={() => navigation.navigate("Login")}
    />
  );
}
