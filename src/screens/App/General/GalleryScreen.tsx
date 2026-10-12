import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppHeader,
  AppText,
  AsyncList,
  FilterChips,
  IconButton,
  Screen,
  SmartImage,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { errorMessage } from "../../../services/apiClient";
import { getGalleryImages, type GalleryImage } from "../../../services/galleryService";

const ALL = "All";

/** Photos of WorkNest spaces (GET /gallery/all), filterable by category, with a full-screen viewer. */
export default function GalleryScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState(ALL);
  const [viewer, setViewer] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      setImages(await getGalleryImages());
    } catch (err) {
      setError(errorMessage(err, "The gallery could not be loaded. Please try again."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(images.map((i) => i.category).filter((c): c is string => !!c)))],
    [images],
  );
  const shown = useMemo(() => (category === ALL ? images : images.filter((i) => i.category === category)), [images, category]);
  const current = viewer !== null ? shown[viewer] : null;
  const tile = Math.floor((Math.min(width, 720) - 16 * 2 - 12) / 2);

  return (
    <Screen>
      <AppHeader title="Gallery" subtitle="Our spaces" />
      <AsyncList
        data={shown}
        keyExtractor={(img, i) => String(img.id ?? i)}
        numColumns={2}
        columnWrapperStyle={styles.column}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        error={error}
        ListHeaderComponent={
          categories.length > 2 ? (
            <FilterChips
              value={category}
              onChange={setCategory}
              options={categories.map((c) => ({ label: c, value: c }))}
              style={styles.chips}
              accessibilityLabel="Photo category"
            />
          ) : null
        }
        empty={{ illustration: "image", title: "No photos yet", message: "Photos of our spaces will appear here." }}
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`${item.title}. Open photo`}
            onPress={() => setViewer(index)}
            style={({ pressed }) => [styles.tile, { width: tile }, pressed && styles.pressed]}
          >
            <SmartImage uri={item.src} style={[styles.image, { width: tile, height: tile }]} resizeMode="cover" />
            <AppText variant="captionStrong" numberOfLines={1} style={styles.caption}>
              {item.title}
            </AppText>
          </Pressable>
        )}
      />

      <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <View style={[styles.viewer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.viewerBar}>
            <AppText variant="subheading" color="onHeader" numberOfLines={1} style={styles.flex}>
              {current?.title}
            </AppText>
            <IconButton icon="close" variant="onDark" accessibilityLabel="Close photo" onPress={() => setViewer(null)} />
          </View>
          {current ? <SmartImage uri={current.src} style={styles.full} resizeMode="contain" /> : null}
          {current?.description || current?.locationName ? (
            <AppText variant="bodySmall" color="onHeaderMuted" style={styles.viewerText}>
              {[current.description, current.locationName].filter(Boolean).join("  ·  ")}
            </AppText>
          ) : null}
          <View style={styles.viewerNav}>
            <IconButton
              icon="chevron-back"
              variant="onDark"
              accessibilityLabel="Previous photo"
              disabled={viewer === null || viewer <= 0}
              onPress={() => setViewer((v) => (v !== null && v > 0 ? v - 1 : v))}
            />
            <AppText variant="caption" color="onHeaderMuted">
              {viewer !== null ? `${viewer + 1} of ${shown.length}` : ""}
            </AppText>
            <IconButton
              icon="chevron-forward"
              variant="onDark"
              accessibilityLabel="Next photo"
              disabled={viewer === null || viewer >= shown.length - 1}
              onPress={() => setViewer((v) => (v !== null && v < shown.length - 1 ? v + 1 : v))}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    column: { gap: t.spacing.md },
    chips: { marginBottom: t.spacing.md },
    tile: { gap: t.spacing.xs },
    pressed: { opacity: 0.85 },
    image: { borderRadius: t.radii.card, backgroundColor: c.surfaceAlt },
    caption: { color: c.text },
    flex: { flex: 1 },
    // The photo viewer is a dark lightbox in both themes.
    viewer: { flex: 1, backgroundColor: c.headerBg, paddingHorizontal: t.spacing.lg, gap: t.spacing.md },
    viewerBar: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    full: { flex: 1, width: "100%" },
    viewerText: { textAlign: "center" },
    viewerNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  });
