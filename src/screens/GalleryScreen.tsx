import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
} from "react-native";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, radii } from "../theme";

const images = [
  {
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800",
    alt: "Workspace 1",
  },
  {
    src: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800",
    alt: "Workspace 2",
  },
  {
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800",
    alt: "Workspace 3",
  },
  {
    src: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800",
    alt: "Workspace 4",
  },
];

const GAP = 12;
const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - GAP) / 2; // 2 columns

export default function GalleryScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Header />

        <View style={styles.hero}>
          <Text style={styles.title}>Gallery</Text>
          <Text style={styles.subtitle}>
            A peek at our spaces and amenities.
          </Text>
        </View>

        <View style={styles.grid}>
          {images.map((image, index) => (
            <View key={index} style={styles.card}>
              <Image
                source={{ uri: image.src }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 24,
  },
  hero: {
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: 20,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.foreground,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: CARD_WIDTH,
    height: 160,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.muted,
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

