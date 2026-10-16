import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { slideLayout } from "./onboardingLayout";
import { setOnboardingCompleted } from "../../utils/onboardingStorage";
import { useAuth } from "../../context/AuthContext";
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

/** Side padding of the screen (dp): a carousel page is the content column minus this on both sides. */
const SIDE_PADDING = 20;
/** Below this window height (a phone in landscape, split screen) the screen scrolls and the card is fixed height. */
const SHORT_WINDOW = 520;

type OnboardingSlideProps = {
  cardWidth: number;
  /** The photo's height in the stacked layout (ignored side by side). */
  imageHeight: number;
  /** Photo on the left, text on the right (wide, short viewport). */
  side: boolean;
  index: number;
  slide: Slide;
  scrollX: SharedValue<number>;
  styles: ReturnType<typeof createStyles>;
  iconColor: string;
};

function OnboardingSlide({
  cardWidth,
  imageHeight,
  side,
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

  const page = useMemo(() => ({ width: cardWidth }), [cardWidth]);
  const imageSize = useMemo(() => ({ height: imageHeight }), [imageHeight]);

  return (
    <View style={page}>
      <Animated.View
        accessible
        accessibilityLabel={`${slide.title}. ${slide.description}`}
        style={[styles.card, side && styles.cardSide, slideAnimatedStyle]}
      >
        <View style={side ? styles.imageFrameSide : [styles.imageFrame, imageSize]}>
          <Animated.Image
            source={slide.image}
            style={styles.cardImage}
            resizeMode="cover"
          />
        </View>
        <View style={[styles.copyBlock, side && styles.copyBlockSide]}>
          <View style={[styles.iconWell, side && styles.iconWellSide]}>
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
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const short = screenHeight < SHORT_WINDOW;
  // A page is exactly the carousel viewport, measured, so it follows rotation and a foldable switching screens.
  // Until the first layout: Screen's column (the window minus side insets, at most MAX_CONTENT_WIDTH) minus padding.
  const estimatedWidth =
    Math.min(Math.max(0, screenWidth - insets.left - insets.right), MAX_CONTENT_WIDTH) - 2 * SIDE_PADDING;
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    const height = Math.floor(event.nativeEvent.layout.height);
    setViewport((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  const cardWidth = Math.max(1, viewport.width || estimatedWidth);
  const layout = slideLayout({ width: cardWidth, height: viewport.height, windowHeight: screenHeight, fontScale, short });
  // Short window: a fixed card height (the screen scrolls), not the flexible one that fills the screen.
  const fixedViewport = useMemo(
    () => (layout.cardHeight !== null ? { flex: 0, height: layout.cardHeight } : null),
    [layout.cardHeight],
  );
  const scrollX = useSharedValue(0);
  const { user } = useAuth();

  // The page width changed (rotation, a foldable opened or closed): keep showing the same slide.
  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: indexRef.current * cardWidth, animated: false });
  }, [cardWidth]);

  const isLast = currentIndex === slides.length - 1;

  // First launch: the introduction is shown before Login, so it continues to Login (or the app when signed in).
  const leave = () => {
    if (user) navigation.replace("AppStack", { screen: "MainTabs" });
    else navigation.replace("AuthStack", { screen: "Login" });
  };

  const finishOnboarding = async () => {
    await setOnboardingCompleted();
    leave();
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
      finishOnboarding().catch(leave);
      return;
    }

    goToIndex(currentIndex + 1);
  };

  const handleSkip = () => {
    finishOnboarding().catch(leave);
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
    setCurrentIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const content = (
    <>
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

      <View style={[styles.cardViewport, fixedViewport]} onLayout={onViewportLayout}>
        <AnimatedFlatList
          ref={listRef}
          data={slides}
          extraData={`${cardWidth}x${layout.imageHeight}${layout.side ? "s" : ""}`}
          initialScrollIndex={currentIndex}
          keyExtractor={(item) => item.title}
          renderItem={({ item, index }) => (
            <OnboardingSlide
              cardWidth={cardWidth}
              imageHeight={layout.imageHeight}
              side={layout.side}
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
    </>
  );

  // A short window (a phone in landscape) scrolls; otherwise the card fills the space between header and button.
  return (
    <Screen>
      {short ? (
        <ScrollView contentContainerStyle={[styles.container, styles.containerShort]} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        <View style={styles.container}>{content}</View>
      )}
    </Screen>
  );
}

const createStyles = (colors: AppColors, theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 8,
    paddingBottom: 20,
  },
  containerShort: { flex: 0, flexGrow: 1, paddingBottom: 12 },
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
  // Fills the page (the carousel viewport). No minimum height: on a short window the screen scrolls instead.
  card: {
    flex: 1,
    borderRadius: theme.radii.sheet,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSide: { flexDirection: "row" },
  // Height from slideLayout (4:3, at most about half the card).
  imageFrame: {
    width: "100%",
    backgroundColor: colors.surfaceAlt,
  },
  // Side by side: stretched to the card's height by the row.
  imageFrameSide: {
    width: "45%",
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
  // Side by side the icon sits at the top of the text, not overlapping a photo above it.
  iconWellSide: { marginTop: 0 },
  copyBlock: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 22,
    paddingBottom: 22,
    gap: 10,
  },
  copyBlockSide: { paddingTop: 22, justifyContent: "center" },
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
