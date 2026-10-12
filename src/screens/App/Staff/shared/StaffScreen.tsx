import { useContext, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import type { Edge } from "react-native-safe-area-context";
import { Screen } from "../../../../components/ui";

/** True when the screen is a tab root (inside the bottom tabs), false when it was pushed on the stack. */
export function useInTabs(): boolean {
  return useContext(BottomTabBarHeightContext) != null;
}

/**
 * <Screen> for staff screens: inside the tabs the tab bar already covers the bottom inset, so only the top and
 * sides are padded; pushed screens (no tab bar) get every edge.
 */
export function StaffScreen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const inTabs = useInTabs();
  const edges: Edge[] = inTabs ? ["top", "left", "right"] : ["top", "left", "right", "bottom"];
  return (
    <Screen edges={edges} style={style}>
      {children}
    </Screen>
  );
}
