import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { useThemeColors, useThemedStyles } from "../../theme";
import { hasCompletedOnboarding } from "../../utils/onboardingStorage";
import { hydrateSessionUser } from "../../services/authService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

      timer = setTimeout(() => {
        navigation.replace("AppStack", { screen: "MainTabs" });
      }, 1500);
    };

    checkAuth().catch(() => {
      timer = setTimeout(() => {
        navigation.replace("AppStack", { screen: "MainTabs" });
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
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={styles.brandBlock}>
          <View style={styles.logoWell}>
            <View style={styles.logoGlow} />
            <Image
              source={require("../../../public/Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brand}>WorkNest</Text>
          <View style={styles.taglineRow}>
            <View style={styles.taglineDot} />
            <Text style={styles.subtitle}>Workspace Booking Platform</Text>
            <View style={styles.taglineDot} />
          </View>
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
    overflow: "hidden",
  },
  bgCircle1: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.4,
    height: SCREEN_WIDTH * 1.4,
    borderRadius: SCREEN_WIDTH * 0.7,
    backgroundColor: colors.primaryMuted,
    top: -SCREEN_WIDTH * 0.7,
    left: -SCREEN_WIDTH * 0.2,
    opacity: 0.6,
  },
  bgCircle2: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    backgroundColor: colors.primary,
    bottom: -SCREEN_WIDTH * 0.5,
    right: -SCREEN_WIDTH * 0.3,
    opacity: 0.08,
  },
  brandBlock: {
    alignItems: "center",
  },
  logoWell: {
    width: 108,
    height: 108,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
  logoGlow: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 34,
    backgroundColor: colors.secondary,
    opacity: 0.35,
  },
  logo: {
    width: 64,
    height: 64,
  },
  brand: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: colors.foreground,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  taglineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  spinner: {
    position: "absolute",
    bottom: 64,
  },
});

