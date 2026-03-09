import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { setOnboardingCompleted } from "../../utils/onboardingStorage";

type Slide = {
  title: string;
  description: string;
};

const slides: Slide[] = [
  {
    title: "Find Your Space",
    description:
      "Explore offices, meeting rooms, and co-working spaces that match your work style.",
  },
  {
    title: "Book In Minutes",
    description:
      "Choose your preferred date and time, then confirm your booking in a few taps.",
  },
  {
    title: "Manage Easily",
    description:
      "Track bookings, pricing plans, and workspace details from one place.",
  },
];

export default function OnboardingScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLast = currentIndex === slides.length - 1;
  const slide = useMemo(() => slides[currentIndex], [currentIndex]);

  const finishOnboarding = async () => {
    await setOnboardingCompleted();
    navigation.replace("AuthStack", { screen: "Login" });
  };

  const handleNext = () => {
    if (isLast) {
      finishOnboarding().catch(() => {
        navigation.replace("AuthStack", { screen: "Login" });
      });
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const handleSkip = () => {
    finishOnboarding().catch(() => {
      navigation.replace("AuthStack", { screen: "Login" });
    });
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.stepText}>
            {currentIndex + 1} / {slides.length}
          </Text>
          {!isLast ? (
            <Pressable onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : (
            <View />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>

          <View style={styles.dotsRow}>
            {slides.map((_, index) => {
              const active = index === currentIndex;
              return (
                <View
                  key={`dot-${index}`}
                  style={[styles.dot, active && styles.dotActive]}
                />
              );
            })}
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={handleNext}>
          <Text style={styles.primaryButtonText}>
            {isLast ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepText: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: "700",
  },
  skipText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    flex: 1,
    marginTop: 24,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "800",
  },
  description: {
    marginTop: 14,
    color: colors.mutedForeground,
    fontSize: 16,
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "700",
  },
});
