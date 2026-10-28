import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../../theme";

/** The scrolling body of an Attendance section, with pull to refresh (the spinner stays until `onRefresh` settles). */
export function SectionScroll({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
          progressBackgroundColor={colors.surfaceRaised}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
  });
