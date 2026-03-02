import { useEffect, useMemo, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { resolveBundledImage } from "../assets/imageRegistry";

const DEFAULT_FALLBACK_URI =
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&auto=format&fit=crop";

type SmartImageProps = {
  uri?: string | null;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  fallbackUri?: string;
};

export function SmartImage({
  uri,
  style,
  resizeMode = "cover",
  fallbackUri = DEFAULT_FALLBACK_URI,
}: SmartImageProps) {
  const normalizedUri = useMemo(() => (uri ?? "").trim(), [uri]);
  const bundledSource = useMemo(
    () => resolveBundledImage(normalizedUri),
    [normalizedUri]
  );
  const [activeUri, setActiveUri] = useState(
    normalizedUri.length > 0 ? normalizedUri : fallbackUri
  );

  useEffect(() => {
    setActiveUri(normalizedUri.length > 0 ? normalizedUri : fallbackUri);
  }, [fallbackUri, normalizedUri]);

  const source: ImageSourcePropType =
    bundledSource ?? { uri: activeUri };

  return (
    <Image
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        if (bundledSource) {
          return;
        }
        if (activeUri !== fallbackUri) {
          setActiveUri(fallbackUri);
        }
      }}
    />
  );
}
