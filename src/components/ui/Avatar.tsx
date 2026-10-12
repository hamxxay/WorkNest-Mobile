import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fontFor, useTheme, type Tone } from "../../theme";

export type AvatarProps = {
  /** Used for initials and the default accessibility label. */
  name?: string | null;
  /** Remote photo; falls back to initials if it fails to load. */
  uri?: string | null;
  /** Diameter in dp. Default 40. */
  size?: number;
  /** Colour family. Default: picked from the name so the same person always gets the same colour. */
  tone?: Tone;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const AUTO_TONES: Tone[] = ["primary", "info", "indigo", "success", "warning"];

/** "Ahmad Adil Amin" -> "AA"; "ahmad" -> "A"; "" -> "?". */
export function initialsOf(name?: string | null): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

function toneFor(name?: string | null): Tone {
  const s = String(name ?? "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 1000003;
  return AUTO_TONES[Math.abs(hash) % AUTO_TONES.length];
}

/** Circular avatar: photo when available, otherwise coloured initials. */
export function Avatar({ name, uri, size = 40, tone, accessibilityLabel, style }: AvatarProps) {
  const { tones } = useTheme();
  const [failed, setFailed] = useState(false);
  const cleanUri = (uri ?? "").trim();
  useEffect(() => setFailed(false), [cleanUri]);

  const t = tones[tone ?? toneFor(name)];
  const box = { width: size, height: size, borderRadius: size / 2 };
  const label = accessibilityLabel ?? (name ? `${name}` : "Avatar");

  if (cleanUri && !failed) {
    return (
      <Image
        source={{ uri: cleanUri }}
        onError={() => setFailed(true)}
        accessibilityLabel={label}
        style={[box, { backgroundColor: t.bg }, style as any]}
      />
    );
  }
  return (
    <View accessible accessibilityLabel={label} style={[styles.center, box, { backgroundColor: t.bg }, style]}>
      <Text
        maxFontSizeMultiplier={1.2}
        style={[styles.initials, { color: t.fg, fontSize: Math.max(12, Math.round(size * 0.38)) }]}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: fontFor("600"),
});
