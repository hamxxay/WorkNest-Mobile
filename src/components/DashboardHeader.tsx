import { drawerNavRef } from "../navigation/AppNavigator";
import { AppHeader, type HeaderAction } from "./ui/AppHeader";

type Props = {
  /** Top label shown above the title, e.g. "ADMIN" or "SALES" */
  role: string;
  /** Main title shown in the header */
  title: string;
  /** Optional line under the title. */
  subtitle?: string;
  /** Extra icon buttons shown before the menu button (e.g. notifications bell with a badge). */
  actions?: HeaderAction[];
  /** Show the drawer menu button. Default true. */
  showMenu?: boolean;
  /** Default: opens the role drawer. */
  onMenuPress?: () => void;
};

/**
 * Staff dashboard header (navy bar, logo, role overline, title, menu button). Kept for existing screens; it now
 * renders AppHeader variant="dashboard", which also colours the status bar to match.
 */
export function DashboardHeader({ role, title, subtitle, actions = [], showMenu = true, onMenuPress }: Props) {
  const menu: HeaderAction[] = showMenu
    ? [{ icon: "menu-outline", accessibilityLabel: "Open menu", onPress: onMenuPress ?? (() => drawerNavRef.open()) }]
    : [];
  return <AppHeader variant="dashboard" overline={role} title={title} subtitle={subtitle} actions={[...actions, ...menu]} />;
}
