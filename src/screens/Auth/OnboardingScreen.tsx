import { useMemo, useState } from "react";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { setOnboardingCompleted } from "../../utils/onboardingStorage";
import type { ImageSourcePropType } from "react-native";

type Slide = {
  title: string;
  description: string;
  image: ImageSourcePropType;
};

const slides: Slide[] = [
  {
    title: "Find Your Space",
    description:
      "Explore offices, meeting rooms, and co-working spaces that match your work style.",
    image: require("../../../public/images/spaces/creative-cowork.jpg"),
  },
  {
    title: "Book In Minutes",
    description:
      "Choose your preferred date and time, then confirm your booking in a few taps.",
    image: require("../../../public/images/spaces/meeting-room.jpg"),
  },
  {
    title: "Manage Easily",
    description:
      "Track bookings, pricing plans, and workspace details from one place.",
    image: require("../../../public/images/gallery/team-collab.jpg"),
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

        <ImageBackground
          source={slide.image}
          style={styles.card}
          imageStyle={styles.cardImage}
        >
          <View style={styles.cardOverlay}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>WorkNest</Text>
            </View>

            <View style={styles.copyBlock}>
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
          </View>
        </ImageBackground>

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
    overflow: "hidden",
    minHeight: 420,
  },
  cardImage: {
    borderRadius: radii.lg,
  },
  cardOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
    backgroundColor: "rgba(20, 30, 53, 0.38)",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(245, 248, 255, 0.9)",
  },
  badgeText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  copyBlock: {
    marginTop: "auto",
    borderRadius: radii.md,
    padding: 18,
    backgroundColor: "rgba(20, 30, 53, 0.6)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
  },
  description: {
    marginTop: 14,
    color: "rgba(255,255,255,0.88)",
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
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    width: 24,
    backgroundColor: "#FFFFFF",
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
