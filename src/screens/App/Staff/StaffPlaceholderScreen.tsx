import { StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useThemeColors, useThemedStyles, type AppColors } from "../../../theme";

// Stand-in for staff screens that are built in the next stage (with the new UI kit). The navigator shows the
// screen title in its header; this body only says the screen is not ready yet.
export default function StaffPlaceholderScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.root} accessibilityRole="summary">
      <Ionicons name="construct-outline" size={40} color={colors.mutedForeground} />
      <Text style={styles.title}>Coming soon</Text>
      <Text style={styles.body}>This screen is being added to the WorkNest staff app.</Text>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 8,
      backgroundColor: colors.background,
    },
    title: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
    body: { color: colors.mutedForeground, fontSize: 14, textAlign: "center" },
  });
