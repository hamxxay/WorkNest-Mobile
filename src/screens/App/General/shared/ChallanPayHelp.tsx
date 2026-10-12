import { StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, Card } from "../../../../components/ui";
import { useThemeColors } from "../../../../theme";

/**
 * How to pay a WorkNest bank challan (same wording as worknestpk.com). Payment is by challan only:
 * the app never takes card or wallet payments and never marks anything paid itself.
 */
export function ChallanPayHelp({ compact = false }: { compact?: boolean }) {
  const colors = useThemeColors();
  return (
    <Card variant="filled">
      <View style={styles.row}>
        <Ionicons name="business-outline" size={20} color={colors.primary} />
        <AppText variant="subheading" style={styles.flex}>
          How to pay
        </AppText>
      </View>
      <AppText variant="bodySmall" color="textSecondary" style={styles.gap}>
        Pay the challan at any HBL branch counter, ATM, or in your mobile banking app under 1Bill / Bill Payment
        using the challan (consumer) number.
      </AppText>
      {compact ? null : (
        <>
          <AppText variant="bodySmall" color="textSecondary" style={styles.gap}>
            Bank: Habib Bank Limited (HBL). Account title: WorkNest (Private) Limited.
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" style={styles.gap}>
            Keep your receipt. Your booking is confirmed once the payment reaches us; the status here updates
            automatically. If you pay in cash, hand over the original challan at reception.
          </AppText>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  gap: { marginTop: 6 },
});
