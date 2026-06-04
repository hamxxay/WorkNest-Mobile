import { StatusBar, StyleSheet, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import AppNavigator from "./src/navigation/AppNavigator";
import { store } from "./src/store/store";
import { AuthProvider } from "./src/context/AuthContext";
import { getThemeColors } from "./src/theme";

function App() {
  const colorScheme = useColorScheme();
  const themeColors = getThemeColors(colorScheme);
  const isDarkTheme = colorScheme === "dark";

  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <AuthProvider>
          <SafeAreaProvider>
            <StatusBar
              barStyle={isDarkTheme ? "light-content" : "dark-content"}
              backgroundColor={themeColors.background}
              translucent={false}
            />
            <AppNavigator />
          </SafeAreaProvider>
        </AuthProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
