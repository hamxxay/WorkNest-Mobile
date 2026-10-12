import { useContext, useEffect, useState, type ReactNode } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarHeightContext,
  type BottomTabBarProps,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { CommonActions, type Route } from "@react-navigation/native";
import { radii, useTheme, type AppColors } from "../../theme";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { Badge } from "./Badge";
import {
  ACTIVE_TAB_EXTRA,
  TAB_BAR_HEIGHT,
  TAB_BAR_MAX_WIDTH,
  TAB_BAR_PADDING,
  TAB_BAR_SIDE_MARGIN,
  TAB_ITEM_HEIGHT,
  clampTabPosition,
  tabActiveness,
  tabBarBottomOffset,
  tabBarSpace,
  tabUnitWidth,
} from "./tabBarMetrics";

// Floating pill tab bar for the customer and staff bottom tabs. Usage and design notes: ./docs/tab-bar.md

/** Icon size inside the bar. */
const ICON_SIZE = 22;
/** How far the icon moves up to make room for the label under it when its tab is selected. */
const ICON_LIFT = 10;
/** Label distance from the bottom of the item. */
const LABEL_BOTTOM = 6;
/** Indicator movement between tabs: quick, settles with a barely visible overshoot. */
const INDICATOR_SPRING = { damping: 24, stiffness: 240, mass: 1 } as const;

/**
 * Bottom padding a tab screen needs so its last row can scroll clear of the floating tab bar: bar + gap + bottom
 * inset. 0 outside a bottom-tab navigator (pushed stack screens, sheets opened from them), so shared components can
 * always add it. AsyncList already does; ScrollView screens add it to their own paddingBottom.
 */
export function useTabBarSpace(): number {
  const inTabs = useContext(BottomTabBarHeightContext) != null;
  const insets = useContext(SafeAreaInsetsContext);
  return inTabs ? tabBarSpace(insets?.bottom ?? 0) : 0;
}

/** True while the software keyboard is open (Android reports it after it has opened). */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subscriptions = [
      Keyboard.addListener(showEvent, () => setShown(true)),
      Keyboard.addListener(hideEvent, () => setShown(false)),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);
  return shown;
}

function labelOf(options: BottomTabNavigationOptions, route: Route<string>): string {
  if (typeof options.tabBarLabel === "string") return options.tabBarLabel;
  return options.title ?? route.name;
}

/** A tab badge as a number for <Badge>: numbers as is, numeric strings parsed ("99+" -> 100), else a dot. */
function badgeCount(badge: BottomTabNavigationOptions["tabBarBadge"]): { count?: number; dot?: boolean } | null {
  if (badge == null || badge === "" || badge === 0) return null;
  if (typeof badge === "number") return { count: badge };
  const parsed = parseInt(badge, 10);
  if (Number.isNaN(parsed)) return { dot: true };
  return { count: badge.trim().endsWith("+") ? parsed + 1 : parsed };
}

export type TabBarProps = BottomTabBarProps & {
  /** Slide the bar away while the keyboard is open. Default true. */
  hideOnKeyboard?: boolean;
};

/**
 * Floating pill tab bar. Pass it to a bottom-tab navigator:
 *
 *   <Tab.Navigator tabBar={renderTabBar} screenOptions={{ headerShown: false, animation: "fade" }}>
 *   const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;
 *
 * Reads the standard tab options: `tabBarIcon` (called with focused true for the filled glyph and false for the
 * outline one), `tabBarLabel` / `title`, `tabBarBadge`, `tabBarAccessibilityLabel`, `tabBarButtonTestID`.
 * The active tab is wider and shows its label under a filled icon on a soft primary pill that slides between tabs.
 */
export function TabBar({ state, descriptors, navigation, insets, hideOnKeyboard = true }: TabBarProps) {
  const { colors, shadows } = useTheme();
  const reduceMotion = useReduceMotion();
  const keyboardShown = useKeyboardShown();
  const hidden = hideOnKeyboard && keyboardShown;
  const count = state.routes.length;
  const bottom = tabBarBottomOffset(insets.bottom);

  // Report the bar's footprint so useBottomTabBarHeight() agrees with useTabBarSpace().
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  useEffect(() => {
    onHeightChange?.(tabBarSpace(insets.bottom));
  }, [onHeightChange, insets.bottom]);

  // Fractional index of the selected tab; everything in the bar (indicator, widths, labels) follows it.
  const position = useSharedValue(state.index);
  const rowWidth = useSharedValue(0);
  const hide = useSharedValue(hidden ? 1 : 0);

  useEffect(() => {
    position.value = reduceMotion ? state.index : withSpring(state.index, INDICATOR_SPRING);
  }, [position, state.index, reduceMotion]);

  useEffect(() => {
    const to = hidden ? 1 : 0;
    hide.value = reduceMotion
      ? to
      : withTiming(to, { duration: hidden ? 160 : 220, easing: hidden ? Easing.in(Easing.quad) : Easing.out(Easing.cubic) });
  }, [hide, hidden, reduceMotion]);

  const settled = useDerivedValue(() => clampTabPosition(position.value, count));

  const barStyle = useAnimatedStyle(() => ({
    opacity: 1 - hide.value,
    transform: [{ translateY: hide.value * (TAB_BAR_HEIGHT + bottom + 16) }],
  }));

  const indicatorStyle = useAnimatedStyle(() => {
    const unit = tabUnitWidth(rowWidth.value, count);
    return {
      opacity: unit > 0 ? 1 : 0,
      width: unit * (1 + ACTIVE_TAB_EXTRA),
      transform: [{ translateX: unit * settled.value }],
    };
  });

  const onRowLayout = (e: LayoutChangeEvent) => {
    rowWidth.value = e.nativeEvent.layout.width;
  };

  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "box-none"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      style={[
        styles.wrap,
        { bottom, left: insets.left + TAB_BAR_SIDE_MARGIN, right: insets.right + TAB_BAR_SIDE_MARGIN },
        barStyle,
      ]}
    >
      <View
        accessibilityRole="tablist"
        style={[styles.pill, { backgroundColor: colors.tabBar, borderColor: colors.border }, shadows.lg]}
      >
        <View style={styles.row} onLayout={onRowLayout}>
          <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: colors.primarySoft }, indicatorStyle]} />
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = labelOf(options, route);

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.dispatch({ ...CommonActions.navigate(route.name, route.params), target: state.key });
              }
            };
            const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });

            return (
              <TabItem
                key={route.key}
                index={index}
                position={settled}
                focused={focused}
                label={label}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                testID={options.tabBarButtonTestID}
                icon={options.tabBarIcon}
                badge={badgeCount(options.tabBarBadge)}
                colors={colors}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

type TabItemProps = {
  index: number;
  position: SharedValue<number>;
  focused: boolean;
  label: string;
  accessibilityLabel: string;
  testID?: string;
  icon: BottomTabNavigationOptions["tabBarIcon"];
  badge: { count?: number; dot?: boolean } | null;
  colors: AppColors;
  onPress: () => void;
  onLongPress: () => void;
};

function TabItem({
  index,
  position,
  focused,
  label,
  accessibilityLabel,
  testID,
  icon,
  badge,
  colors,
  onPress,
  onLongPress,
}: TabItemProps) {
  const { typography } = useTheme();
  const active = useDerivedValue(() => tabActiveness(position.value, index));

  // Selected tab grows to 1.5 widths; its icon lifts and its label fades in underneath.
  const itemStyle = useAnimatedStyle(() => ({ flexGrow: 1 + ACTIVE_TAB_EXTRA * active.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -ICON_LIFT * active.value }] }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: active.value }));
  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - active.value }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: active.value * active.value,
    transform: [{ translateY: (1 - active.value) * 4 }, { scale: 0.9 + 0.1 * active.value }],
  }));

  const activeColor = colors.onPrimarySoft;
  const inactiveColor = colors.tabInactive;
  const filled: ReactNode = icon?.({ focused: true, color: activeColor, size: ICON_SIZE });
  const outline: ReactNode = icon?.({ focused: false, color: inactiveColor, size: ICON_SIZE });

  return (
    <Animated.View style={[styles.item, itemStyle]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        android_ripple={{ color: colors.ripple, borderless: true, radius: TAB_ITEM_HEIGHT / 2 + 4 }}
        style={styles.pressable}
      >
        <View style={styles.content} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Animated.View style={[styles.icon, iconStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, outlineStyle]}>{outline}</Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, filledStyle]}>{filled}</Animated.View>
            {badge ? <Badge count={badge.count} dot={badge.dot} ring={colors.tabBar} style={badge.dot ? styles.dot : styles.badge} /> : null}
          </Animated.View>
          <Animated.Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.15}
            style={[typography.captionStrong, styles.label, { color: activeColor }, labelStyle]}
          >
            {label}
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", alignItems: "center" },
  pill: {
    width: "100%",
    maxWidth: TAB_BAR_MAX_WIDTH,
    height: TAB_BAR_HEIGHT,
    padding: TAB_BAR_PADDING,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flex: 1, flexDirection: "row" },
  indicator: {
    position: "absolute",
    left: 0,
    top: 0,
    height: TAB_ITEM_HEIGHT,
    borderRadius: radii.pill,
  },
  item: { flexBasis: 0, height: TAB_ITEM_HEIGHT },
  pressable: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  icon: { width: ICON_SIZE, height: ICON_SIZE },
  badge: { position: "absolute", top: -8, left: ICON_SIZE - 8 },
  dot: { position: "absolute", top: -3, right: -5 },
  label: {
    position: "absolute",
    bottom: LABEL_BOTTOM,
    left: -12,
    right: -12,
    textAlign: "center",
    includeFontPadding: false,
  },
});
