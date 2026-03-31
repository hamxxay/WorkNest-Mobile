import { useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
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

type OnboardingSlideProps = {
  cardWidth: number;
  index: number;
  slide: Slide;
  scrollX: Animated.SharedValue<number>;
};

function OnboardingSlide({
  cardWidth,
  index,
  slide,
  scrollX,
}: OnboardingSlideProps) {
  const slideAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * cardWidth,
      index * cardWidth,
      (index + 1) * cardWidth,
    ];

    return {
      opacity: interpolate(
        scrollX.value,
        inputRange,
        [0.72, 1, 0.72],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            inputRange,
            [0.97, 1, 0.97],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: interpolate(
            scrollX.value,
            inputRange,
            [12, 0, 12],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <View style={{ width: cardWidth }}>
      <Animated.View style={[styles.card, slideAnimatedStyle]}>
        <View style={styles.imageFrame}>
          <Animated.Image
            source={slide.image}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <View style={styles.imageShade} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>WorkNest</Text>
          </View>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Slide>);

export default function OnboardingScreen() {
  const styles = useThemedStyles(createStyles);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 40;
  const scrollX = useSharedValue(0);

  const isLast = currentIndex === slides.length - 1;

  const finishOnboarding = async () => {
    await setOnboardingCompleted();
    navigation.replace("AuthStack", { screen: "Login" });
  };

  const goToIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
    listRef.current?.scrollToOffset({
      animated: true,
      offset: nextIndex * cardWidth,
    });
    setCurrentIndex(nextIndex);
  };

  const handleNext = () => {
    if (isLast) {
      finishOnboarding().catch(() => {
        navigation.replace("AuthStack", { screen: "Login" });
      });
      return;
    }

    goToIndex(currentIndex + 1);
  };

  const handleSkip = () => {
    finishOnboarding().catch(() => {
      navigation.replace("AuthStack", { screen: "Login" });
    });
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
    setCurrentIndex(nextIndex);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

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

        <View style={styles.cardViewport}>
          <AnimatedFlatList
            ref={listRef}
            data={slides}
            keyExtractor={(item) => item.title}
            renderItem={({ item, index }) => (
              <OnboardingSlide
                cardWidth={cardWidth}
                index={index}
                slide={item}
                scrollX={scrollX}
              />
            )}
            horizontal
            pagingEnabled
            bounces={false}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={styles.carouselContent}
            getItemLayout={(_, index) => ({
              index,
              length: cardWidth,
              offset: cardWidth * index,
            })}
          />

          <View pointerEvents="box-none" style={styles.tapOverlay}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
              onPress={() => goToIndex(currentIndex - 1)}
              style={styles.tapZone}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isLast ? "Finish onboarding" : "Next slide"}
              onPress={() => {
                if (isLast) {
                  handleNext();
                  return;
                }
                goToIndex(currentIndex + 1);
              }}
              style={styles.tapZone}
            />
          </View>
        </View>

        <View style={styles.dotsRow}>
          {slides.map((slide, index) => {
            const active = index === currentIndex;
            return (
              <View
                key={`dot-${slide.title}`}
                style={[styles.dot, active && styles.dotActive]}
              />
            );
          })}
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

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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
  cardViewport: {
    flex: 1,
    marginTop: 24,
    position: "relative",
  },
  carouselContent: {
    alignItems: "stretch",
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  tapZone: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    minHeight: 420,
    backgroundColor: "#F4F7FB",
  },
  imageFrame: {
    position: "relative",
    width: "100%",
    aspectRatio: 3 / 2,
    backgroundColor: "#DCE5F2",
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 30, 53, 0.18)",
  },
  badge: {
    position: "absolute",
    top: 18,
    left: 18,
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
    flex: 1,
    justifyContent: "flex-end",
    padding: 22,
    backgroundColor: "#F4F7FB",
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
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(20, 30, 53, 0.2)",
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
