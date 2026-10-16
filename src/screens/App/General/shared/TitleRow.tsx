import { useMemo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText, type AppTextProps } from "../../../../components/ui";
import { spacing } from "../../../../theme";
import { useResponsive } from "../../../../utils/responsive";

/** Narrowest the title gets beside the pill at the default font size (dp). It grows with the font size. */
export const TITLE_MIN_WIDTH = 120;

type TitleRowProps = {
  title: string;
  variant?: AppTextProps["variant"];
  color?: AppTextProps["color"];
  /** Max lines of the title (0 = no limit). Default 1, or 2 with large text. */
  numberOfLines?: number;
  /** A status pill or another short element after the title. */
  right?: ReactNode;
  accessibilityRole?: AppTextProps["accessibilityRole"];
  style?: StyleProp<ViewStyle>;
};

/**
 * A card title with a status pill after it. The pill stays on the title's line while the title keeps at least
 * TITLE_MIN_WIDTH (scaled with the font size); on a narrow phone, the Fold cover screen or with large text the pill
 * moves under the title instead of squeezing it into a few letters.
 */
export function TitleRow({ title, variant = "subheading", color, numberOfLines, right, accessibilityRole, style }: TitleRowProps) {
  const { textScale, isLargeText } = useResponsive();
  const lines = numberOfLines ?? (isLargeText ? 2 : 1);
  const basis = useMemo(() => ({ flexBasis: Math.round(TITLE_MIN_WIDTH * textScale) }), [textScale]);
  return (
    <View style={[styles.row, style]}>
      <AppText
        variant={variant}
        color={color}
        numberOfLines={lines}
        accessibilityRole={accessibilityRole}
        style={[styles.title, basis]}
      >
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.sm, rowGap: spacing.xs },
  title: { flexGrow: 1, flexShrink: 1 },
});
