import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Screen } from "../../../components/Screen";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import { useTheme } from "../../../theme";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the form (e.g. "New to WorkNest? Create account"). */
  footer?: ReactNode;
};

/**
 * Shared frame for Login / Signup: WorkNest logo (navy tile + wordmark), title, subtitle, keyboard-aware scrolling form,
 * max 440dp wide (centred on tablets).
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { colors, typography } = useTheme();
  const { width } = useWindowDimensions();
  const glow = Math.round(width * 1.1);

  return (
    <Screen>
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          { width: glow, height: glow, borderRadius: glow / 2, top: -glow * 0.62, right: -glow * 0.3, backgroundColor: colors.primarySoft },
        ]}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <BrandLogo variant="tile" size={44} wordmark wordmarkVariant="heading" style={styles.brand} />

            <Text accessibilityRole="header" style={[typography.display, { color: colors.text }]}>
              {title}
            </Text>
            {subtitle ? <Text style={[typography.body, styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}

            <View style={styles.form}>{children}</View>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** "or" separator between the email form and Google sign-in. */
export function OrDivider({ label = "or" }: { label?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.orRow} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.orLine, { backgroundColor: colors.border }]} />
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.orLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  glow: { position: "absolute" },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  column: { width: "100%", maxWidth: 440, alignSelf: "center", flexGrow: 1 },
  brand: { marginBottom: 28 },
  subtitle: { marginTop: 6 },
  form: { marginTop: 28, gap: 16 },
  footer: { marginTop: 24, alignItems: "center" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
});
