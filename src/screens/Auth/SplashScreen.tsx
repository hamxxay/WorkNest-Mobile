import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
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
        <View style={styles.brandBlock}>
          <View style={styles.logoWell}>
            <Image
              source={require("../../../public/Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brand}>WorkNest</Text>
          <Text style={styles.subtitle}>Workspace Booking Platform</Text>
        </View>
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      </View>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandBlock: {
    alignItems: "center",
  },
  logoWell: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  logo: {
    width: 58,
    height: 58,
  },
  brand: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.foreground,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 15,
    fontWeight: "500",
    marginTop: 6,
  },
  spinner: {
    position: "absolute",
    bottom: 64,
  },
});

