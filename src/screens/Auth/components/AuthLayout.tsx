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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../../components/Screen";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import { useTheme } from "../../../theme";
import { MAX_CONTENT_WIDTH } from "../../../utils/responsive";

/** Widest the form column gets (dp). */
const FORM_MAX_WIDTH = 440;
/** Side padding of the form (dp). */
const SIDE_PADDING = 24;

/** Width of the form column for the current window: inside the side padding, at most FORM_MAX_WIDTH. */
export function useAuthFormWidth(): number {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const column = Math.min(Math.max(0, width - insets.left - insets.right), MAX_CONTENT_WIDTH);
  return Math.max(0, Math.min(column - 2 * SIDE_PADDING, FORM_MAX_WIDTH));
}

/** Below this window height (a phone in landscape, split screen) the logo and title take less room above the form. */
const SHORT_WINDOW = 520;

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
  const { width, height } = useWindowDimensions();
  // Sized from the content column (the window on phones, 720dp on tablets), so it is not a giant disc on a tablet.
  const glow = Math.round(Math.min(width, MAX_CONTENT_WIDTH) * 1.1);
  const short = height < SHORT_WINDOW;

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
          contentContainerStyle={[styles.content, short && styles.contentShort]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <BrandLogo variant="tile" size={44} wordmark wordmarkVariant="heading" style={short ? styles.brandShort : styles.brand} />

            <Text accessibilityRole="header" style={[typography.display, { color: colors.text }]}>
              {title}
            </Text>
            {subtitle ? <Text style={[typography.body, styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}

            <View style={[styles.form, short && styles.formShort]}>{children}</View>

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
  content: { flexGrow: 1, paddingHorizontal: SIDE_PADDING, paddingTop: 32, paddingBottom: 32 },
  contentShort: { paddingTop: 16, paddingBottom: 16 },
  column: { width: "100%", maxWidth: FORM_MAX_WIDTH, alignSelf: "center", flexGrow: 1 },
  brand: { marginBottom: 28 },
  brandShort: { marginBottom: 16 },
  subtitle: { marginTop: 6 },
  form: { marginTop: 28, gap: 16 },
  formShort: { marginTop: 20 },
  footer: { marginTop: 24, alignItems: "center" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
});
