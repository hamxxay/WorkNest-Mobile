import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../theme";
import { Button } from "./ui/Button";

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
    if (__DEV__) console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback onRetry={this.retry} />;
  }
}

/** Themed recovery screen (follows light / dark mode). */
function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} accessibilityRole="alert">
      <View style={[styles.iconWell, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="alert-circle-outline" size={34} color={colors.onPrimarySoft} />
      </View>
      <Text style={[typography.title, styles.center, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[typography.body, styles.center, styles.body, { color: colors.textMuted }]}>
        This screen ran into a problem. Please try again. If it keeps happening, close and reopen the app.
      </Text>
      <Button title="Try again" leftIcon="refresh" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  iconWell: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  center: { textAlign: "center" },
  body: { maxWidth: 320 },
  button: { marginTop: 8, minWidth: 160 },
});
