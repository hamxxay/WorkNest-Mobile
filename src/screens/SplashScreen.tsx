import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Screen } from "../components/Screen";
import { colors } from "../theme";
import { isAuthenticated } from "../utils/authStorage";

export default function SplashScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkAuth = async () => {
      const hasSession = await isAuthenticated();

      timer = setTimeout(() => {
        navigation.replace(hasSession ? "MainTabs" : "Login");
      }, 1500);
    };

    checkAuth().catch(() => {
      timer = setTimeout(() => {
        navigation.replace("Login");
      }, 1500);
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [navigation]);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.brand}>WorkNest</Text>
        <Text style={styles.subtitle}>Workspace Booking Platform</Text>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  brand: {
    fontSize: 42,
    fontWeight: "800",
    color: colors.foreground,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 16,
    marginBottom: 8,
  },
});
