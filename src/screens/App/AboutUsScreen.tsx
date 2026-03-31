import { StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";

export default function AboutUsScreen() {
  const styles = useThemedStyles(createStyles);
  return (
    <Screen>
      <View style={styles.content}>
        <Header />
        <View style={styles.card}>
          <Text style={styles.title}>About Us</Text>
          <Text style={styles.text}>
            WorkNest helps freelancers, startups, and teams discover and book
            modern workspaces quickly and reliably.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: 16,
    gap: 10,
  },
  title: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "800",
  },
  text: {
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 22,
  },
});
