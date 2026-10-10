import { PropsWithChildren } from "react";
import { StatusBar, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors, useThemedStyles } from "../theme";
import { MAX_CONTENT_WIDTH, useResponsive } from "../utils/responsive";

type ScreenProps = PropsWithChildren<{ style?: ViewStyle }>;

export function Screen({ children, style }: ScreenProps) {
  const colors = useThemeColors();
  const { isTablet } = useResponsive();
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: c.background },
      // Tablets / unfolded phones: a centred column instead of content stretched edge to edge.
      column: { flex: 1, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" },
    }),
  );

  return (
    <SafeAreaView style={[styles.root, style]} edges={["top", "left", "right", "bottom"]}>
      <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
      {isTablet ? <View style={styles.column}>{children}</View> : children}
    </SafeAreaView>
  );
}
