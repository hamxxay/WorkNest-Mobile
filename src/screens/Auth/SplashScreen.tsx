import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { useThemeColors, useThemedStyles } from "../../theme";
import { hasCompletedOnboarding } from "../../utils/onboardingStorage";
import { hydrateSessionUser } from "../../services/authService";

export default function SplashScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkAuth = async () => {
      const onboardingDone = await hasCompletedOnboarding();
      if (!onboardingDone) {
        timer = setTimeout(() => {
          navigation.replace("Onboarding");
        }, 1500);
        return;
      }

      const user = await hydrateSessionUser();
      const hasSession = Boolean(user);

      timer = setTimeout(() => {
        if (hasSession) {
          navigation.replace("AppStack", { screen: "MainTabs" });
          return;
        }
        navigation.replace("AuthStack", { screen: "Login" });
      }, 1500);
    };

    checkAuth().catch(() => {
      timer = setTimeout(() => {
        navigation.replace("AuthStack", { screen: "Login" });
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

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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

