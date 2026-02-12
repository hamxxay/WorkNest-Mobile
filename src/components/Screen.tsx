import { PropsWithChildren } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

type ScreenProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

export function Screen({ children, style }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.root, style]} edges={["top", "left", "right","bottom"]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
