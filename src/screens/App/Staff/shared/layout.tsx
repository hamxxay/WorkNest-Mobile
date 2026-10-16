import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { useScreenColumnWidth } from "../../../../components/ui/screenChrome";
import { spacing } from "../../../../theme";
import {
  columnsFor,
  stackActions,
  stackLabelValue,
  textScale,
  useMeasuredWidth,
  type ActionLabel,
} from "../../../../utils/responsive";

// Layout pieces the staff screens share so they hold up on a 320dp phone, the Galaxy Z Fold cover screen, tablets,
// phones in landscape and the largest system font: buttons and fields that share a row go one above the other when
// they don't fit, and the rule for moving a status pill / amount under the text beside it. Everything reads the
// live window (or measures itself), so it follows rotation and a foldable switching screens.

/** Card padding (Card's default), for the first-frame width guess of rows inside a card. */
const CARD_PADDING = 16;

/** Below this many dp of window height per unit of text size, filters pinned above a list leave no room for it. */
export const SHORT_WINDOW_HEIGHT = 500;

/**
 * Narrowest a DateField in a FieldRow may get at the default font size (dp): its box (icon, padding) plus
 * "Mon, 12 Oct 2026", so two dates share a row on tablets / unfolded foldables and stack on phones.
 */
export const DATE_FIELD_MIN_WIDTH = 180;
/** The same for a time DateField ("10:30 AM"): side by side on most phones, stacked on 320dp or with large text. */
export const TIME_FIELD_MIN_WIDTH = 136;

function elements(children: ReactNode): ReactElement[] {
  return Children.toArray(children).filter(isValidElement);
}

/**
 * The labels of the Buttons in a row (title, and whether an icon or a spinner sits before it). A Button that may
 * show a spinner (has a `loading` prop, even false) is counted with its icon, so the row does not flip between
 * side by side and stacked when the spinner appears.
 */
export function actionLabels(children: ReactNode): ActionLabel[] | number {
  const items = elements(children);
  const labels: ActionLabel[] = [];
  for (const item of items) {
    const props = item.props as { title?: unknown; leftIcon?: unknown; loading?: unknown };
    if (typeof props.title !== "string") return items.length;
    labels.push({ title: props.title, icon: !!props.leftIcon || props.loading !== undefined });
  }
  return labels;
}

export type ActionRowProps = {
  /** Two or three <Button>s (no `style={{ flex: 1 }}` needed: the row sizes them). */
  children: ReactNode;
  /** Gap between the buttons. Default 8. */
  gap?: number;
  /** Width to assume before the first layout. Default: the screen's content column minus the screen padding. */
  estimatedWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Buttons sharing a row, equal widths. When their labels don't fit side by side (small phone, Fold cover screen,
 * large text: utils/responsive stackActions) they go one above the other at full width, in the order given.
 */
export function ActionRow({ children, gap = spacing.sm, estimatedWidth, style, testID }: ActionRowProps) {
  const { fontScale } = useWindowDimensions();
  const columnWidth = useScreenColumnWidth();
  const [width, onLayout] = useMeasuredWidth(estimatedWidth ?? columnWidth - 2 * spacing.screen);
  const items = elements(children);
  const stacked = stackActions(width, fontScale, actionLabels(items), gap);
  return (
    <View testID={testID} onLayout={onLayout} style={[stacked ? styles.column : styles.row, { gap }, style]}>
      {items.map((child, i) => (
        <View key={child.key ?? i} style={stacked ? undefined : styles.cell}>
          {child}
        </View>
      ))}
    </View>
  );
}

export type FieldRowProps = {
  /** Two fields (From / To, start / end date). Give them no flex style: the row sizes them. */
  children: ReactNode;
  /** Narrowest a field may get at the default font size (dp) before the fields go one above the other. */
  minItemWidth: number;
  /** Gap side by side. Default 12. */
  gap?: number;
  /** Gap one above the other (the form's gap between fields). Default 16. */
  stackedGap?: number;
  /** Width to assume before the first layout. Default: the content column minus the screen and card padding. */
  estimatedWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Fields side by side when each gets at least `minItemWidth` (more with large text), otherwise one above the other
 * (small phones, large text). Side by side they share the width equally and align at the top (error texts).
 */
export function FieldRow({
  children,
  minItemWidth,
  gap = spacing.md,
  stackedGap = spacing.lg,
  estimatedWidth,
  style,
  testID,
}: FieldRowProps) {
  const { fontScale } = useWindowDimensions();
  const columnWidth = useScreenColumnWidth();
  const [width, onLayout] = useMeasuredWidth(estimatedWidth ?? columnWidth - 2 * spacing.screen - 2 * CARD_PADDING);
  const items = elements(children);
  const sideBySide =
    items.length > 1 && columnsFor(width, { minItemWidth, gap, fontScale, maxColumns: items.length }) >= items.length;
  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[sideBySide ? styles.fieldRow : null, { gap: sideBySide ? gap : stackedGap }, style]}
    >
      {items.map((child, i) => (
        <View key={child.key ?? i} style={sideBySide ? styles.cell : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * True when a status pill or an amount that sits beside a title should go under it instead: large system text on
 * a narrow window, where side by side the title would get a few letters per line. The same rule InfoRow and
 * ListRow use (stackLabelValue). Never true at the default text size.
 */
export function useStackedMeta(): boolean {
  const { width, fontScale } = useWindowDimensions();
  return stackLabelValue(width, fontScale);
}

/**
 * True when the window is too short for search / filter bars pinned above a list (a phone in landscape, or large
 * text on a small phone): those screens then scroll the filters away with the list (ListHeaderComponent).
 */
export function useShortWindow(): boolean {
  const { height, fontScale } = useWindowDimensions();
  return height / textScale(fontScale) < SHORT_WINDOW_HEIGHT;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch" },
  column: { flexDirection: "column" },
  fieldRow: { flexDirection: "row", alignItems: "flex-start" },
  cell: { flex: 1, minWidth: 0 },
});
