import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { GalleryImage, getGalleryImages } from "../../services/galleryService";
import { SmartImage } from "../../components/SmartImage";
import Ionicons from "react-native-vector-icons/Ionicons";

const categories = ["All", "Offices", "Meeting Rooms", "Co-Working", "Lounges"];

export default function GalleryScreen() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    getGalleryImages()
      .then((items) => setImages(items))
      .finally(() => setLoading(false));
  }, []);

  const filteredImages = useMemo(() => {
    if (activeCategory === "All") {
      return images;
    }

    return images.filter((image) => image.category === activeCategory);
  }, [activeCategory, images]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.hero}>
          <Text style={styles.title}>Gallery</Text>
          <Text style={styles.subtitle}>
            Explore our workspace collection by category.
          </Text>
        </View>

        <View style={styles.filterRow}>
          {categories.map((category) => {
            const active = activeCategory === category;
            return (
              <Pressable
                key={category}
                onPress={() => setActiveCategory(category)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? <Text style={styles.helper}>Loading gallery...</Text> : null}
        {!loading && filteredImages.length === 0 ? (
          <Text style={styles.helper}>No images in this category yet.</Text>
        ) : null}

        <View style={styles.grid}>
          {filteredImages.map((image, index) => (
            <Pressable
              key={`gallery-item-${String(image.id ?? "missing")}-${index}`}
              style={styles.card}
              onPress={() => setLightboxImage(image)}
            >
              <SmartImage uri={image.src} style={styles.image} resizeMode="cover" />
              <View style={styles.overlay}>
                <Text style={styles.overlayTitle}>{image.title}</Text>
                {!!image.category && <Text style={styles.overlaySub}>{image.category}</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!lightboxImage} transparent animationType="fade" onRequestClose={() => setLightboxImage(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalClose} onPress={() => setLightboxImage(null)}>
            <Ionicons name="close" color={colors.background} size={22} />
          </Pressable>
          {lightboxImage ? (
            <View style={styles.modalContent}>
              <SmartImage uri={lightboxImage.src} style={styles.modalImage} resizeMode="cover" />
              <Text style={styles.modalTitle}>{lightboxImage.title}</Text>
              {lightboxImage.description ? (
                <Text style={styles.modalDesc}>{lightboxImage.description}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  hero: {
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: 20,
    marginBottom: 14,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
  subtitle: { marginTop: 8, fontSize: 16, color: colors.mutedForeground },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.mutedForeground, fontSize: 13, fontWeight: "700" },
  filterTextActive: { color: colors.background },
  helper: { color: colors.mutedForeground, marginBottom: 12 },
  grid: { gap: 12 },
  card: {
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.muted,
    height: 180,
  },
  image: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  overlayTitle: { color: colors.background, fontSize: 14, fontWeight: "700" },
  overlaySub: { color: "#cbd5e1", fontSize: 12, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalClose: { position: "absolute", right: 20, top: 48, zIndex: 2 },
  modalContent: { gap: 10 },
  modalImage: { width: "100%", height: 280, borderRadius: radii.md },
  modalTitle: { color: colors.background, fontSize: 20, fontWeight: "700" },
  modalDesc: { color: "#cbd5e1", fontSize: 14 },
});
