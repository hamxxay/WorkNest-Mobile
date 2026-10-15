import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { useThemeColors, useThemedStyles } from "../../theme";
import { hasCompletedOnboarding, setOnboardingCompleted } from "../../utils/onboardingStorage";
import { getPendingEmailVerification } from "../../services/authService";
import { SplashContent } from "./splash/SplashContent";
import { createSplashStyles } from "./splash/styles";
import { useSplashAnimation } from "./splash/useSplashAnimation";
import { useAuth } from "../../context/AuthContext";

// Long enough for the brand animation (~0.8 s) without holding the user up; the session itself is restored
// before this screen mounts (RootNavigator shows a spinner until then).
const MIN_SPLASH_DURATION = 800;
const MIN_SPLASH_DURATION_REDUCED_MOTION = 300;

export default function SplashScreen() {
  const styles = useThemedStyles(createSplashStyles);
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [reduceMotion, setReduceMotion] = useState(false);
  const animation = useSplashAnimation(reduceMotion);
  // Measured from first mount, so re-running the effect below never extends the wait.
  const mountedAt = useRef(Date.now()).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    const finish = (onboardingDone: boolean) => {
      const minimum = reduceMotion ? MIN_SPLASH_DURATION_REDUCED_MOTION : MIN_SPLASH_DURATION;
      const remaining = Math.max(0, minimum - (Date.now() - mountedAt));
      setTimeout(() => {
        if (!active) return;
        animation.fadeOut(() => {
          if (!active) return;

          if (!user) {
            // Signed up but the email link was not opened yet: back to "Verify your email".
            const pending = getPendingEmailVerification();
            if (pending) {
              navigation.replace("AuthStack", { screen: "VerifyEmail", params: { email: pending.email } });
              return;
            }
            // First launch: the short introduction comes before Login (it then opens Login).
            if (!onboardingDone) {
              navigation.replace("Onboarding");
              return;
            }
            navigation.replace("AuthStack", { screen: "Login" });
            return;
          }

          // Someone who is signed in already knows the app: no introduction (also for installs from before the
          // introduction was remembered at sign-in).
          if (!onboardingDone) setOnboardingCompleted().catch(() => undefined);
          navigation.replace("AppStack", { screen: "MainTabs" });
        });
      }, remaining);
    };

    hasCompletedOnboarding().then(finish).catch(() => finish(true));
    return () => { active = false; };
  }, [animation, mountedAt, navigation, reduceMotion, user]);

  return (
    <Screen backgroundColor={colors.headerBg} statusBarColor={colors.headerBg}>
      <SplashContent animation={animation} styles={styles} />
    </Screen>
  );
}
