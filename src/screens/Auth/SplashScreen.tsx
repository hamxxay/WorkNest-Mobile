import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { useThemedStyles } from "../../theme";
import { hasCompletedOnboarding } from "../../utils/onboardingStorage";
import { SplashContent } from "./splash/SplashContent";
import { createSplashStyles } from "./splash/styles";
import { useSplashAnimation } from "./splash/useSplashAnimation";

const MIN_SPLASH_DURATION = 2200;

export default function SplashScreen() {
  const styles = useThemedStyles(createSplashStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reduceMotion, setReduceMotion] = useState(false);
  const animation = useSplashAnimation(reduceMotion);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    const finish = (onboardingDone: boolean) => {
      const remaining = Math.max(0, MIN_SPLASH_DURATION - (Date.now() - startedAt));
      setTimeout(() => {
        if (!active) return;
        animation.fadeOut(() => {
          if (!active) return;
          if (onboardingDone) navigation.replace("AppStack", { screen: "MainTabs" });
          else navigation.replace("Onboarding");
        });
      }, remaining);
    };

    hasCompletedOnboarding().then(finish).catch(() => finish(true));
    return () => { active = false; };
  }, [animation, navigation]);

  return <Screen><SplashContent animation={animation} styles={styles} /></Screen>;
}
