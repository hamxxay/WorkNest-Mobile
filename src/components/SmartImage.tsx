import { useEffect, useMemo, useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { resolveBundledImage } from "../assets/imageRegistry";
import { useTheme } from "../theme";

type SmartImageProps = {
  /** Remote URL or a bundled path known to imageRegistry ("images/spaces/lounge.jpg"). */
  uri?: string | null;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Optional second URL tried if `uri` fails. No remote default: failures show a neutral placeholder. */
  fallbackUri?: string;
  /** Describe the picture for screen readers. Omit for decorative images. */
  accessibilityLabel?: string;
  /** Ionicons name drawn in the placeholder. Default "image-outline". */
  placeholderIcon?: string;
};

/**
 * Image with a themed placeholder while loading and when the image is missing or fails.
 * Bundled images (imageRegistry) render directly; remote ones fade in over the placeholder.
 */
export function SmartImage({
  uri,
  style,
  resizeMode = "cover",
  fallbackUri,
  accessibilityLabel,
  placeholderIcon = "image-outline",
}: SmartImageProps) {
  const { colors } = useTheme();
  const normalizedUri = useMemo(() => (uri ?? "").trim(), [uri]);
  const bundledSource = useMemo(() => resolveBundledImage(normalizedUri), [normalizedUri]);
  const [activeUri, setActiveUri] = useState(normalizedUri || fallbackUri || "");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setActiveUri(normalizedUri || fallbackUri || "");
    setLoaded(false);
    setFailed(false);
  }, [fallbackUri, normalizedUri]);

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: "no" as const };

  if (bundledSource) {
    return <Image source={bundledSource} style={style} resizeMode={resizeMode} {...a11y} />;
  }

  const flat = (StyleSheet.flatten(style) ?? {}) as ImageStyle;
  const showImage = !!activeUri && !failed;

  return (
    <View
      {...a11y}
      style={[flat as ViewStyle, styles.frame, { backgroundColor: colors.surfaceAlt }]}
    >
      {!loaded ? (
        <View style={styles.placeholder} pointerEvents="none">
          <Ionicons name={placeholderIcon} size={28} color={colors.textDisabled} />
        </View>
      ) : null}
      {showImage ? (
        <Image
          source={{ uri: activeUri }}
          resizeMode={resizeMode}
          style={[StyleSheet.absoluteFill, { borderRadius: flat.borderRadius }]}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            if (fallbackUri && activeUri !== fallbackUri) {
              setActiveUri(fallbackUri);
            } else {
              setFailed(true);
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
  placeholder: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
