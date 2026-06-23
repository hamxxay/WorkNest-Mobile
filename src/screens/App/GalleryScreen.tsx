import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { GalleryImage, getGalleryImages } from "../../services/galleryService";
import { SmartImage } from "../../components/SmartImage";
import Ionicons from "react-native-vector-icons/Ionicons";

const { width: SW, height: SH } = Dimensions.get("window");
const categories = ["All", "Offices", "Meeting Rooms", "Co-Working", "Lounges"];

const SPRING = { damping: 22, stiffness: 280, mass: 0.8 };

// ─── Lightbox ─────────────────────────────────────────────────────────────────
type LightboxProps = {
  images: GalleryImage[];
  startIndex: number;
  onClose: () => void;
};

function Lightbox({ images, startIndex, onClose }: LightboxProps) {
  const colors = useThemeColors();
  const [index, setIndex] = useState(startIndex);
  const image = images[index];

  // backdrop opacity
  const backdropOpacity = useSharedValue(0);
  // card enter
  const cardScale = useSharedValue(0.82);
  const cardOpacity = useSharedValue(0);
  // zoom / pan state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  // swipe nav
  const swipeX = useSharedValue(0);
  const navOpacity = useSharedValue(1);

  function resetZoom() {
    "worklet";
    scale.value = withSpring(1, SPRING);
    translateX.value = withSpring(0, SPRING);
    translateY.value = withSpring(0, SPRING);
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
  }

  // mount animation
  useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: 260 });
    cardScale.value = withSpring(1, SPRING);
    cardOpacity.value = withTiming(1, { duration: 220 });
  }, []);

  // reset zoom when index changes
  useEffect(() => {
    resetZoom();
  }, [index]);

  function navigateTo(next: number) {
    swipeX.value = withTiming(0, { duration: 0 });
    setIndex(next);
  }

  function handleClose() {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    cardScale.value = withTiming(0.84, { duration: 200 });
    cardOpacity.value = withTiming(0, { duration: 200 }, () =>
      runOnJS(onClose)()
    );
  }

  // ── Gestures ──────────────────────────────────────────────────────────────
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
      scale.value = next;
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1, SPRING);
        translateX.value = withSpring(0, SPRING);
        translateY.value = withSpring(0, SPRING);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .minDistance(2)
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        // panning a zoomed image
        const maxX = ((scale.value - 1) * SW) / 2;
        const maxY = ((scale.value - 1) * SH) / 2;
        translateX.value = Math.min(
          Math.max(savedX.value + e.translationX, -maxX),
          maxX
        );
        translateY.value = Math.min(
          Math.max(savedY.value + e.translationY, -maxY),
          maxY
        );
      } else {
        // swipe to navigate
        swipeX.value = e.translationX;
        navOpacity.value = interpolate(
          Math.abs(e.translationX),
          [0, SW * 0.3],
          [1, 0.3],
          Extrapolation.CLAMP
        );
      }
    })
    .onEnd((e) => {
      if (scale.value > 1.05) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      } else {
        const threshold = SW * 0.28;
        if (e.translationX < -threshold && index < images.length - 1) {
          swipeX.value = withTiming(-SW, { duration: 220 }, () =>
            runOnJS(navigateTo)(index + 1)
          );
        } else if (e.translationX > threshold && index > 0) {
          swipeX.value = withTiming(SW, { duration: 220 }, () =>
            runOnJS(navigateTo)(index - 1)
          );
        } else {
          swipeX.value = withSpring(0, SPRING);
        }
        navOpacity.value = withTiming(1, { duration: 180 });
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.2) {
        resetZoom();
      } else {
        scale.value = withSpring(2.4, SPRING);
        savedScale.value = 2.4;
      }
    });

  const composed = Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, pan));

  // ── Animated styles ────────────────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + swipeX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
  const navStyle = useAnimatedStyle(() => ({
    opacity: navOpacity.value,
  }));

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4,14,12,0.96)" }, backdropStyle]}
      />

      {/* Tap backdrop to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      {/* Image card */}
      <Animated.View style={[styles.lbCard, cardStyle]}>
        <GestureDetector gesture={composed}>
          <Animated.View style={styles.lbImageWrap}>
            <Animated.Image
              source={{ uri: image.src }}
              style={[styles.lbImage, imageStyle]}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {/* Top bar */}
      <Animated.View style={[styles.lbTopBar, navStyle]} pointerEvents="box-none">
        <Pressable style={styles.lbCloseBtn} onPress={handleClose} hitSlop={10}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <View style={styles.lbCounter}>
          <Text style={styles.lbCounterText}>
            {index + 1} / {images.length}
          </Text>
        </View>
        <View style={styles.lbZoomHint}>
          <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.lbZoomHintText}>Pinch or double-tap to zoom</Text>
        </View>
      </Animated.View>

      {/* Prev / Next */}
      <Animated.View style={[styles.lbNavRow, navStyle]} pointerEvents="box-none">
        {index > 0 ? (
          <Pressable
            style={[styles.lbNavBtn, styles.lbNavLeft]}
            onPress={() => navigateTo(index - 1)}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.lbNavBtn} />
        )}
        {index < images.length - 1 ? (
          <Pressable
            style={[styles.lbNavBtn, styles.lbNavRight]}
            onPress={() => navigateTo(index + 1)}
            hitSlop={10}
          >
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.lbNavBtn} />
        )}
      </Animated.View>

      {/* Caption */}
      <Animated.View style={[styles.lbCaption, navStyle]} pointerEvents="none">
        <Text style={styles.lbCaptionTitle} numberOfLines={1}>
          {image.title}
        </Text>
        {!!image.category && (
          <Text style={styles.lbCaptionSub}>{image.category}</Text>
        )}
        {!!image.description && (
          <Text style={styles.lbCaptionDesc} numberOfLines={2}>
            {image.description}
          </Text>
        )}
      </Animated.View>

      {/* Dot strip */}
      {images.length > 1 && (
        <Animated.View style={[styles.lbDots, navStyle]} pointerEvents="none">
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.lbDot,
                i === index && styles.lbDotActive,
              ]}
            />
          ))}
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function GalleryScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    getGalleryImages()
      .then((items) => setImages(items))
      .finally(() => setLoading(false));
  }, []);

  const filteredImages = useMemo(() => {
    if (activeCategory === "All") return images;
    return images.filter((img) => img.category === activeCategory);
  }, [activeCategory, images]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.hero}>
          <Text style={styles.title}>Gallery</Text>
          <Text style={styles.subtitle}>Explore our workspace collection.</Text>
        </View>

        {/* Category filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {categories.map((cat) => {
            const active = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="hourglass-outline" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>Loading gallery…</Text>
          </View>
        ) : !loading && filteredImages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No images in this category yet.</Text>
          </View>
        ) : null}

        {/* Masonry-style grid: alternating full / half-half rows */}
        <View style={styles.grid}>
          {filteredImages.map((img, idx) => {
            const isFeatured = idx % 5 === 0;
            return (
              <Pressable
                key={`gallery-${String(img.id ?? "x")}-${idx}`}
                style={({ pressed }) => [
                  styles.card,
                  isFeatured ? styles.cardFull : styles.cardHalf,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => setLightboxIndex(idx)}
              >
                <SmartImage uri={img.src} style={styles.cardImage} resizeMode="cover" />
                {/* hover-style teal gradient overlay */}
                <View style={styles.cardOverlay} pointerEvents="none" />
                <View style={styles.cardMeta} pointerEvents="none">
                  <View style={styles.cardTag}>
                    <Text style={styles.cardTagText}>{img.category ?? "Space"}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {img.title}
                  </Text>
                </View>
                <View style={styles.cardZoomIcon} pointerEvents="none">
                  <Ionicons name="expand-outline" size={16} color="rgba(255,255,255,0.75)" />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Lightbox modal */}
      <Modal
        visible={lightboxIndex !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setLightboxIndex(null)}
      >
        <StatusBar hidden />
        {lightboxIndex !== null && (
          <Lightbox
            images={filteredImages}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </Modal>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // lightbox
  lbCard: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  lbImageWrap: {
    width: SW,
    height: SH,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  lbImage: {
    width: SW,
    height: SH * 0.72,
  },
  lbTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(4,14,12,0.55)",
  },
  lbCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  lbCounter: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  lbCounterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  lbZoomHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lbZoomHintText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
  },
  lbNavRow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    pointerEvents: "box-none",
  },
  lbNavBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(13,148,136,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  lbNavLeft: {},
  lbNavRight: {},
  lbCaption: {
    position: "absolute",
    bottom: 72,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    gap: 3,
  },
  lbCaptionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  lbCaptionSub: {
    color: "#5eead4",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  lbCaptionDesc: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    marginTop: 2,
  },
  lbDots: {
    position: "absolute",
    bottom: 38,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  lbDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  lbDotActive: {
    width: 20,
    backgroundColor: "#0d9488",
  },
});

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    content: { paddingHorizontal: 18, paddingBottom: 32 },
    hero: {
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.md,
      padding: 20,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
    subtitle: { marginTop: 6, fontSize: 14, color: colors.mutedForeground },
    filterRow: { gap: 8, marginBottom: 16, paddingRight: 4 },
    filterChip: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.mutedForeground, fontSize: 13, fontWeight: "700" },
    filterTextActive: { color: "#fff" },
    emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
    emptyText: { color: colors.mutedForeground, fontSize: 14 },
    // grid
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    card: {
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.muted,
    },
    cardFull: {
      width: "100%",
      height: 210,
    },
    cardHalf: {
      width: "47.5%",
      height: 140,
    },
    cardPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.975 }],
    },
    cardImage: { width: "100%", height: "100%" },
    cardOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(4,24,20,0.38)",
    },
    cardMeta: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 10,
      gap: 3,
    },
    cardTag: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    cardTagText: {
      color: "#fff",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    cardTitle: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
      textShadowColor: "rgba(0,0,0,0.4)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    cardZoomIcon: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
  });
