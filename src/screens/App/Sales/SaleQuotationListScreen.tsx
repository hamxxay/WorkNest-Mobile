import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../../components/Header";
import { Screen } from "../../../components/Screen";
import { useThemeColors, useThemedStyles } from "../../../theme";
import { getQuotations, type QuotationRecord } from "../../../services/quotationService";

export default function SaleQuotationListScreen({ navigation }: { navigation: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getQuotations();
      setQuotations(Array.isArray(result) ? result : []);
    } catch (error) {
      console.warn("Failed to load quotations", error);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  return (
    <Screen>
      <Header />
      <View style={styles.headerWrap}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Ionicons name="document-text-outline" size={22} color={colors.white} />
          </View>
          <View>
            <Text style={styles.eyebrow}>QUOTATIONS</Text>
            <Text style={styles.title}>Quotation List</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate("QuotationCreate")}>
          <Ionicons name="add-circle-outline" size={18} color={colors.white} />
          <Text style={styles.newBtnText}>New Quote</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {quotations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No quotations found yet.</Text>
              <TouchableOpacity style={styles.emptyAction} onPress={() => navigation.navigate("QuotationCreate")}>
                <Text style={styles.emptyActionText}>Create a quotation</Text>
              </TouchableOpacity>
            </View>
          ) : (
            quotations.map((quotation, index) => (
              <View key={quotation.id ?? `quotation-${index}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.nameText}>#{quotation.id ?? `QT-${index + 1}`}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{quotation.status ?? "Draft"}</Text>
                  </View>
                </View>

                {quotation.customerId ? <Text style={styles.metaText}>Customer ID: {quotation.customerId}</Text> : null}
                {quotation.spaceId ? <Text style={styles.metaText}>Space ID: {quotation.spaceId}</Text> : null}
                {quotation.validUntil ? <Text style={styles.metaText}>Valid Until: {quotation.validUntil}</Text> : null}
                {quotation.totalAmount != null ? <Text style={styles.metaText}>Total: PKR {Number(quotation.totalAmount).toLocaleString()}</Text> : null}
                {quotation.remarks ? <Text style={styles.metaText}>Remarks: {quotation.remarks}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    headerWrap: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 1,
      color: colors.primary,
      fontWeight: "800",
    },
    title: {
      fontSize: 24,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    newBtnText: {
      color: colors.white,
      fontWeight: "700",
      fontSize: 12,
    },
    listContainer: { paddingHorizontal: 18, paddingBottom: 28, gap: 12 },
    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 6,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    nameText: {
      color: colors.foreground,
      fontWeight: "800",
      fontSize: 16,
      flex: 1,
    },
    badge: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 10,
      textTransform: "capitalize",
    },
    metaText: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 30,
      alignItems: "center",
      gap: 10,
    },
    emptyText: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    emptyAction: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    emptyActionText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 12,
    },
  });
