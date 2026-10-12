import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useAuth } from "../../../context/AuthContext";
import { moreMenuFor } from "../../../navigation/staff/access";
import type { StaffTabParamList } from "../../../navigation/staffTypes";
import { useThemeColors, useThemedStyles, type AppColors } from "../../../theme";

type Props = BottomTabScreenProps<StaffTabParamList, "More">;

// "More" tab: every other screen the signed-in role may open, grouped like the CMS sidebar.
// Stage 2 restyles this with the UI kit; the menu itself comes from navigation/staff/access.ts.
export default function StaffMoreScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { staffRole } = useAuth();
  const sections = staffRole ? moreMenuFor(staffRole) : [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
          <View style={styles.card}>
            {section.items.map((item, index) => (
              <Pressable
                key={item.route}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                android_ripple={{ color: colors.primaryMuted }}
                style={[styles.row, index > 0 && styles.rowDivider]}
                // Pushed screens live in the stack around the tabs; navigate() bubbles up to it.
                onPress={() => (navigation as any).navigate(item.route)}
              >
                <Ionicons name={item.icon} size={22} color={colors.primary} />
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 20 },
    section: { gap: 8 },
    sectionTitle: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 52, paddingHorizontal: 16 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    rowLabel: { flex: 1, color: colors.foreground, fontSize: 15, fontWeight: "600" },
  });
