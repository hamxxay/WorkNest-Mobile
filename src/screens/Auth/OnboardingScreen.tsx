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
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import type { RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { useThemeColors, useThemedStyles, type AppColors, type Theme } from "../../theme";
import { Button } from "../../components/ui";
import { MAX_CONTENT_WIDTH } from "../../utils/responsive";
import { setOnboardingCompleted } from "../../utils/onboardingStorage";
import type { ImageSourcePropType } from "react-native";

type Slide = {
  title: string;
  description: string;
  image: ImageSourcePropType;
  icon: string;
};

const slides: Slide[] = [
  {
    title: "Find your space",
    description:
      "Explore offices, meeting rooms, and co-working spaces that match your work style.",
    image: require("../../../public/images/spaces/creative-cowork.jpg"),
    icon: "search-outline",
  },
  {
    title: "Book in minutes",
    description:
      "Choose your preferred date and time, then confirm your booking in a few taps.",
    image: require("../../../public/images/spaces/meeting-room.jpg"),
    icon: "calendar-outline",
  },
  {
    title: "Manage easily",
    description:
      "Track bookings, payments, and workspace details from one place.",
    image: require("../../../public/images/gallery/team-collab.jpg"),
    icon: "receipt-outline",
  },
];

type OnboardingSlideProps = {
  cardWidth: number;
  index: number;
  slide: Slide;
  scrollX: SharedValue<number>;
  styles: ReturnType<typeof createStyles>;
  iconColor: string;
};

function OnboardingSlide({
  cardWidth,
  index,
  slide,
  scrollX,
  styles,
  iconColor,
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
      <Animated.View
        accessible
        accessibilityLabel={`${slide.title}. ${slide.description}`}
        style={[styles.card, slideAnimatedStyle]}
      >
        <View style={styles.imageFrame}>
          <Animated.Image
            source={slide.image}
            style={styles.cardImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.copyBlock}>
          <View style={styles.iconWell}>
            <Ionicons name={slide.icon} size={24} color={iconColor} />
          </View>
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
  const colors = useThemeColors();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const { width: screenWidth } = useWindowDimensions();
  // Screen centres a MAX_CONTENT_WIDTH column on tablets; the carousel pages must match that column.
  const cardWidth = Math.min(screenWidth, MAX_CONTENT_WIDTH) - 40;
  const scrollX = useSharedValue(0);

  const isLast = currentIndex === slides.length - 1;

  const finishOnboarding = async () => {
    await setOnboardingCompleted();
    navigation.replace("AppStack", { screen: "MainTabs" });
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
        navigation.replace("AppStack", { screen: "MainTabs" });
      });
      return;
    }

    goToIndex(currentIndex + 1);
  };

  const handleSkip = () => {
    finishOnboarding().catch(() => {
      navigation.replace("AppStack", { screen: "MainTabs" });
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
          <Text style={styles.stepText} accessibilityLabel={`Step ${currentIndex + 1} of ${slides.length}`}>
            {currentIndex + 1} of {slides.length}
          </Text>
          {!isLast ? (
            <Button title="Skip" variant="ghost" size="sm" onPress={handleSkip} accessibilityHint="Skips the introduction" />
          ) : (
            <View style={styles.skipPlaceholder} />
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
                styles={styles}
                iconColor={colors.onPrimary}
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

        <View
          style={styles.dotsRow}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Slides"
          accessibilityValue={{ min: 1, max: slides.length, now: currentIndex + 1, text: `${currentIndex + 1} of ${slides.length}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") goToIndex(currentIndex + 1);
            if (event.nativeEvent.actionName === "decrement") goToIndex(currentIndex - 1);
          }}
        >
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

        <Button
          title={isLast ? "Get started" : "Next"}
          rightIcon={isLast ? "checkmark" : "arrow-forward"}
          size="lg"
          fullWidth
          onPress={handleNext}
          style={styles.primaryButton}
        />
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppColors, theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  stepText: {
    ...theme.typography.label,
    color: colors.textMuted,
  },
  skipPlaceholder: { height: 36 },
  cardViewport: {
    flex: 1,
    marginTop: 12,
    position: "relative",
  },
  carouselContent: {
    alignItems: "stretch",
  },
  tapOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
  },
  tapZone: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: theme.radii.sheet,
    overflow: "hidden",
    minHeight: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageFrame: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceAlt,
  },
  cardImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  iconWell: {
    width: 52,
    height: 52,
    marginTop: -26,
    marginBottom: 4,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryStrong,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  copyBlock: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 22,
    paddingBottom: 22,
    gap: 10,
  },
  title: {
    ...theme.typography.display,
    color: colors.text,
  },
  description: {
    ...theme.typography.body,
    color: colors.textSecondary,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    minHeight: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    marginTop: 16,
  },
});
