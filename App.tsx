import { StatusBar, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import RootNavigator from "./src/navigation/RootNavigator";
import { store } from "./src/store/store";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { ToastProvider } from "./src/components/ui/Toast";
import { ConfirmProvider } from "./src/components/ui/useConfirm";

/** Everything below the providers: themed page background, base status bar, toasts, confirm dialog, navigator. */
function ThemedRoot() {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Base status bar; each <Screen> / header overrides it while focused. */}
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
        translucent={false}
        animated
      />
      <ToastProvider>
        <ConfirmProvider>
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
        </ConfirmProvider>
      </ToastProvider>
    </View>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <Provider store={store}>
          <AuthProvider>
            <SafeAreaProvider>
              <ThemedRoot />
            </SafeAreaProvider>
          </AuthProvider>
        </Provider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
