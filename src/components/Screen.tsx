import { PropsWithChildren } from "react";
import { StatusBar, StyleSheet, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors, useThemedStyles } from "../theme";

type ScreenProps = PropsWithChildren<{ style?: ViewStyle }>;

export function Screen({ children, style }: ScreenProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: c.background },
    }),
  );

  return (
    <SafeAreaView style={[styles.root, style]} edges={["top", "left", "bottom"]}>
      <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
      {children}
    </SafeAreaView>
  );
}
