import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { store } from "./src/store/store";
import { AuthProvider } from "./src/context/AuthContext";

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <AppNavigator />
        </SafeAreaProvider>
      </AuthProvider>
    </Provider>
  );
}

export default App;
