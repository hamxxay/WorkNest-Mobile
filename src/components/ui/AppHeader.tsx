import { useContext, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { NavigationContext, NavigationRouteContext } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { BrandLogo } from "./BrandLogo";
import { IconButton } from "./Button";
import { FocusAwareStatusBar, barStyleFor } from "./FocusAwareStatusBar";
import { useScreenChrome } from "./screenChrome";

export type HeaderAction = {
  /** Ionicons name. */
  icon: string;
  onPress: () => void;
  /** Required: spoken name of the icon button ("Notifications", "Search", "Open menu"). */
  accessibilityLabel: string;
  /** Count badge (e.g. unread notifications). Hidden at 0. */
  badge?: number;
  dot?: boolean;
  disabled?: boolean;
  testID?: string;
};

export type AppHeaderVariant = "brand" | "stack" | "dashboard";

export type AppHeaderProps = {
  /**
   * brand: logo + title/greeting on the page surface (customer home, tab roots).
   * stack (default): back button (automatic when there is a screen to go back to), title, subtitle, actions.
   * dashboard: navy (or teal) bar with logo, overline + title and light icon buttons (staff dashboards).
   * Logo: the WorkNest navy tile on light bars, the silver W on the navy bar (see BrandLogo).
   */
  variant?: AppHeaderVariant;
  title?: string;
  subtitle?: string;
  /** Small uppercase label above the title ("SALES", "WORKNEST"). */
  overline?: string;
  /** Default: automatic for "stack" (shown when the nearest stack can go back), hidden for brand/dashboard. */
  showBack?: boolean;
  /** Default navigation.goBack(). */
  onBack?: () => void;
  /** Right-hand icon buttons (max 3 recommended). */
  actions?: HeaderAction[];
  /** Custom right-hand content, rendered after `actions`. */
  right?: ReactNode;
  /** Custom left-hand content (replaces back button / logo). */
  left?: ReactNode;
  /** Default true for brand/dashboard, false for stack. */
  showLogo?: boolean;
  /** dashboard background: "navy" (default, CMS sidebar colour) or "teal". */
  tone?: "navy" | "teal";
  /**
   * Top safe-area handling. "auto" (default): add the inset only when not inside a <Screen> that already does
   * (no double inset). true/false force it.
   */
  safeArea?: "auto" | boolean;
  /** Bottom hairline. Default true for brand/stack. */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** "Good morning" / "Good afternoon" / "Good evening" for brand headers. */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** True when the nearest stack navigator has a screen below this one (tab roots and stack roots: false). */
function useAutoCanGoBack(): boolean {
  const navigation = useContext(NavigationContext);
  const route = useContext(NavigationRouteContext);
  if (!navigation) return false;
  try {
    let nav: any = navigation;
    let key: string | undefined = route?.key;
    while (nav) {
      const state = nav.getState?.();
      if (state?.type === "stack") {
        const idx = key ? state.routes.findIndex((r: { key: string }) => r.key === key) : -1;
        return (idx >= 0 ? idx : state.index) > 0;
      }
      nav = nav.getParent?.();
      key = undefined;
    }
    return false;
  } catch {
    return navigation.canGoBack();
  }
}

/** One header for the whole app. See src/components/ui/README.md for examples. */
export function AppHeader({
  variant = "stack",
  title,
  subtitle,
  overline,
  showBack,
  onBack,
  actions,
  right,
  left,
  showLogo,
  tone = "navy",
  safeArea = "auto",
  bordered,
  style,
}: AppHeaderProps) {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useContext(NavigationContext);
  const autoBack = useAutoCanGoBack();

  const dark = variant === "dashboard";
  const bg = dark ? (tone === "teal" ? colors.primaryStrong : colors.headerBg) : colors.surface;
  const fg = dark ? colors.onHeader : colors.text;
  const muted = dark ? colors.onHeaderMuted : colors.textMuted;
  const barStyle = barStyleFor(bg);

  const screen = useScreenChrome({ color: bg, barStyle });
  const padTop = safeArea === "auto" ? !screen?.topInsetApplied : safeArea;

  const back = showBack ?? (variant === "stack" ? autoBack : false);
  const logo = showLogo ?? variant !== "stack";
  const border = bordered ?? !dark;
  const handleBack = onBack ?? (() => navigation?.goBack());

  const leading =
    left ??
    (back ? (
      <IconButton
        icon="arrow-back"
        accessibilityLabel="Go back"
        onPress={handleBack}
        variant={dark ? "onDark" : "plain"}
        color={fg}
        style={styles.backBtn}
      />
    ) : logo ? (
      dark ? (
        // Silver W on the navy bar; one-colour white W on the teal bar (silver is too faint on teal).
        <BrandLogo size={34} color={tone === "teal" ? colors.onHeader : undefined} style={styles.logo} />
      ) : (
        <BrandLogo variant="tile" size={36} style={styles.logo} />
      )
    ) : null);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: bg,
          paddingTop: (padTop ? insets.top : 0) + 8,
          borderBottomColor: dark ? colors.headerLine : colors.border,
        },
        border && styles.bordered,
        style,
      ]}
    >
      {!screen ? <FocusAwareStatusBar barStyle={barStyle} /> : null}
      <View style={styles.row}>
        {leading}
        <View style={styles.titles}>
          {overline ? (
            <Text style={[typography.overline, { color: muted }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {overline}
            </Text>
          ) : null}
          {title ? (
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={[variant === "stack" ? typography.heading : styles.brandTitle, { color: fg }]}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[typography.caption, { color: muted }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions?.length || right ? (
          <View style={styles.actions}>
            {actions?.map(a => (
              <IconButton
                key={a.accessibilityLabel}
                icon={a.icon}
                onPress={a.onPress}
                accessibilityLabel={a.accessibilityLabel}
                badge={a.badge}
                dot={a.dot}
                disabled={a.disabled}
                testID={a.testID}
                variant={dark ? "onDark" : "plain"}
                color={fg}
              />
            ))}
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingBottom: 10 },
  bordered: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  backBtn: { marginLeft: -4 },
  logo: { marginLeft: 4 },
  titles: { flex: 1, justifyContent: "center", gap: 1, paddingLeft: 2 },
  brandTitle: { fontSize: 19, lineHeight: 24, fontWeight: "700", letterSpacing: -0.2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
});
