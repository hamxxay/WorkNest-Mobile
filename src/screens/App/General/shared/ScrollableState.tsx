import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useTabBarSpace } from "../../../../components/ui/TabBar";

/**
 * Holds a full-screen EmptyState / ErrorState (or a short message with its button) below the header. The state
 * keeps its place at the top, but scrolls when the window is too short for it (a phone in landscape, the largest
 * text sizes), so its button is never cut off. On a tab screen the end scrolls clear of the floating tab bar.
 */
export function ScrollableState({ children }: { children: ReactNode }) {
  const tabBarSpace = useTabBarSpace();
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, tabBarSpace > 0 && { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
