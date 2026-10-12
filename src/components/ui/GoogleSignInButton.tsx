import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../theme";

export type GoogleSignInButtonProps = {
  onPress: () => void;
  /** "Continue with Google" (default), "Sign in with Google" or "Sign up with Google" per Google's wording. */
  label?: "Continue with Google" | "Sign in with Google" | "Sign up with Google";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The standard multi-colour Google "G" mark (vector, 48x48 grid). */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/**
 * "Continue with Google" button following Google's branding guidelines: pill shape, standard G mark,
 * light theme (white fill, #747775 stroke, #1F1F1F text) and dark theme (#131314 fill, #8E918F stroke,
 * #E3E3E3 text), Roboto medium label. 48dp tall.
 */
export function GoogleSignInButton({
  onPress,
  label = "Continue with Google",
  loading = false,
  disabled = false,
  style,
}: GoogleSignInButtonProps) {
  const { isDark } = useTheme();
  const inactive = disabled || loading;
  const scheme = isDark ? dark : light;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={{ color: isDark ? "rgba(255,255,255,0.12)" : "rgba(31,31,31,0.08)" }}
      style={({ pressed }) => [
        styles.button,
        scheme.button,
        pressed && scheme.pressed,
        inactive && !loading && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={scheme.text.color} /> : <GoogleMark size={20} />}
        <Text style={[styles.label, scheme.text]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "500", includeFontPadding: false },
  disabled: { opacity: 0.5 },
});

const light = StyleSheet.create({
  button: { backgroundColor: "#FFFFFF", borderColor: "#747775" },
  pressed: { backgroundColor: "#F2F2F2" },
  text: { color: "#1F1F1F" },
});

const dark = StyleSheet.create({
  button: { backgroundColor: "#131314", borderColor: "#8E918F" },
  pressed: { backgroundColor: "#1F1F20" },
  text: { color: "#E3E3E3" },
});
