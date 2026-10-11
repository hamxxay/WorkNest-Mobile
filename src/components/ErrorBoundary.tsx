import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { colors } from "../theme";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Catches a crash anywhere below it (e.g. reading a field of missing data) and shows a calm recovery screen
 * instead of closing the app. "Try again" re-renders the app from the navigator down.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Details stay in the developer log; the user only sees the friendly screen.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.root} accessibilityRole="alert">
        <View style={styles.iconWell}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.primary} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          This screen ran into a problem. Please try again. If it keeps happening, close and reopen the app.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.retry}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12, backgroundColor: colors.background },
  iconWell: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryMuted,
    marginBottom: 4,
  },
  title: { fontSize: 19, fontWeight: "800", color: colors.foreground, textAlign: "center" },
  body: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground, textAlign: "center", maxWidth: 320 },
  button: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});
