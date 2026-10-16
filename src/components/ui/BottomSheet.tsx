import { Children, Fragment, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { MAX_CONTENT_WIDTH, stackActions, type ActionLabel } from "../../utils/responsive";
import { Banner } from "./Banner";
import { IconButton } from "./Button";
import { ToastModalHost } from "./Toast";

export type BottomSheetProps = {
  visible: boolean;
  /** Called on backdrop tap, the close button and Android back (unless `dismissible` is false). */
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Small uppercase label above the title. */
  overline?: string;
  children?: ReactNode;
  /** Pinned below the scrolling content (e.g. Save / Cancel buttons). */
  footer?: ReactNode;
  /** Wrap children in a ScrollView. Default true. Set false when children is a FlatList. */
  scrollable?: boolean;
  /** Backdrop tap / back button close the sheet. Default true. Set false while saving. */
  dismissible?: boolean;
  /** Show the x button in the header. Default true when there is a title. */
  showClose?: boolean;
  /** Max height of the sheet. Default "88%". */
  maxHeight?: DimensionValue;
  /** Make the sheet take its max height even with little content (lists with search). */
  fullHeight?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  /** Error pinned above the footer (stays visible while the content scrolls), e.g. "Could not save". */
  error?: string | null | false;
};

/** Width of the sheet's side padding (content and footer). */
const SIDE_PADDING = 20;
const FOOTER_GAP = 12;

/**
 * The buttons of a footer given as a fragment (`<><Button title="Cancel" /><Button title="Save" /></>`), with their
 * labels when they have a `title`, so the footer can tell whether they fit side by side.
 */
function footerActions(footer: ReactNode): ActionLabel[] | number {
  if (!isValidElement(footer) || footer.type !== Fragment) return 1;
  const items = Children.toArray((footer.props as { children?: ReactNode }).children).filter(isValidElement);
  const labels: ActionLabel[] = [];
  for (const item of items) {
    const props = item.props as { title?: unknown; leftIcon?: unknown; loading?: unknown };
    if (typeof props.title !== "string") return items.length;
    labels.push({ title: props.title, icon: !!props.leftIcon || !!props.loading });
  }
  return labels;
}

/**
 * The footer's buttons one above the other: their `flex: 1` (meant for sharing a row) is reset, otherwise in a
 * column inside the height-capped sheet they would grow to fill it.
 */
function stackedFooter(footer: ReactNode): ReactNode {
  if (!isValidElement(footer) || footer.type !== Fragment) return footer;
  const items = Children.toArray((footer.props as { children?: ReactNode }).children);
  return items.map((item) =>
    isValidElement<{ style?: StyleProp<ViewStyle> }>(item)
      ? cloneElement(item, { style: [item.props.style, styles.stackedAction] })
      : item,
  );
}

/**
 * Modal-based bottom sheet (no extra dependencies). Slides up, dims the page, closes on backdrop / back.
 *
 *   <BottomSheet visible={open} onClose={() => setOpen(false)} title="Filter" footer={<Button title="Apply" .../>}>
 *     ...
 *   </BottomSheet>
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  overline,
  children,
  footer,
  scrollable = true,
  dismissible = true,
  showClose,
  maxHeight = "88%",
  fullHeight = false,
  contentStyle,
  testID,
  error,
}: BottomSheetProps) {
  const { colors, radii, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = () => {
    if (dismissible) onClose();
  };

  // Footer buttons that would be too narrow side by side (320dp phone, Fold cover screen, large text) go one
  // above the other, the main action on top.
  const sheetWidth = Math.min(windowWidth - insets.left - insets.right, MAX_CONTENT_WIDTH);
  const stackFooter = !!footer && stackActions(sheetWidth - 2 * SIDE_PADDING, fontScale, footerActions(footer), FOOTER_GAP);
  // With a footer, the footer pads the bottom inset itself.
  const sheetBottomPadding = footer ? 0 : Math.max(insets.bottom, 16);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] });
  const withClose = showClose ?? !!title;
  const hasHeader = !!(title || overline || subtitle || withClose);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
      testID={testID}
    >
      {/* Edge-to-edge: the modal window covers the status and navigation bars and Android no longer resizes it
          for the keyboard, so the sheet stays below the status bar (paddingTop), pads the bottom inset itself and
          moves up with the keyboard on both platforms ("padding"). */}
      <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior="padding">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            importantForAccessibility={dismissible ? "auto" : "no-hide-descendants"}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceRaised,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              maxHeight,
              paddingBottom: sheetBottomPadding,
              transform: [{ translateY }],
            },
            fullHeight && { height: maxHeight },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          {hasHeader ? (
            <View style={styles.header}>
              <View style={styles.headerText}>
                {overline ? <Text style={[typography.overline, { color: colors.textMuted }]}>{overline}</Text> : null}
                {title ? (
                  <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]} numberOfLines={2}>
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]} numberOfLines={3}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {withClose ? (
                <IconButton icon="close" accessibilityLabel="Close" onPress={requestClose} disabled={!dismissible} color={colors.textMuted} />
              ) : null}
            </View>
          ) : null}

          {scrollable ? (
            <ScrollView
              style={fullHeight ? styles.flex : undefined}
              contentContainerStyle={[styles.content, contentStyle]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.flexShrink, fullHeight && styles.flex, contentStyle]}>{children}</View>
          )}

          {error ? (
            <View style={styles.error}>
              <Banner tone="danger" message={error} />
            </View>
          ) : null}

          {footer ? (
            <View
              style={[
                styles.footer,
                stackFooter && styles.footerStacked,
                { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) + 4 },
              ]}
            >
              {stackFooter ? stackedFooter(footer) : footer}
            </View>
          ) : null}
        </Animated.View>
        <ToastModalHost />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center", overflow: "hidden" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 8, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 20, paddingRight: 8, paddingTop: 8, paddingBottom: 4 },
  headerText: { flex: 1, gap: 2, paddingTop: 6 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 12 },
  footer: {
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: FOOTER_GAP,
  },
  // Column-reverse: the last button (the main action) on top, the order unchanged for screen readers.
  footerStacked: { flexDirection: "column-reverse", alignItems: "stretch" },
  stackedAction: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  error: { paddingHorizontal: 20, paddingBottom: 12 },
});
