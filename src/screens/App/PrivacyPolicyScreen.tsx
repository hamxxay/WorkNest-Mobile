import { StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";

export default function PrivacyPolicyScreen() {
  return (
    <Screen>
      <View style={styles.content}>
        <Header />
        <View style={styles.card}>
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.text}>
            WorkNest respects your privacy. We only use your account and booking
            data to provide workspace services and improve app experience.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
