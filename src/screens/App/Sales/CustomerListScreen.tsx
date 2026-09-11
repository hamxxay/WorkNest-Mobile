import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../../components/Screen";
import { Header } from "../../../components/Header";
import { useThemeColors, useThemedStyles } from "../../../theme";
import { getCustomers, type CustomerRecord } from "../../../services/customerService";

export default function CustomerListScreen({ navigation }: { navigation: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCustomers();
      setCustomers(Array.isArray(result) ? result : []);
    } catch (error) {
      console.warn("Failed to load customers", error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  return (
    <Screen>
      <Header />
      <View style={styles.headerWrap}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Ionicons name="people-outline" size={22} color={colors.white} />
          </View>
          <View>
            <Text style={styles.eyebrow}>CUSTOMERS</Text>
            <Text style={styles.title}>Customer List</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate("CustomerCreate")}>
          <Ionicons name="add-circle-outline" size={18} color={colors.white} />
          <Text style={styles.newBtnText}>New Customer</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {customers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No customers found yet.</Text>
              <TouchableOpacity style={styles.emptyAction} onPress={() => navigation.navigate("CustomerCreate")}>
                <Text style={styles.emptyActionText}>Create a customer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            customers.map((customer, index) => (
              <View key={customer.id ?? `${customer.email ?? "customer"}-${index}`} style={styles.customerCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.nameText}>
                    {customer.firstName ?? "Customer"} {customer.lastName ?? ""}
                  </Text>
                  <View style={[styles.statusDot, { backgroundColor: customer.isActive === false ? colors.mutedForeground : colors.primary }]} />
                </View>

                {customer.company ? <Text style={styles.metaText}>{customer.company}</Text> : null}
                {customer.email ? <Text style={styles.metaText}>Email: {customer.email}</Text> : null}
                {customer.phoneNumber ? <Text style={styles.metaText}>Phone: {customer.phoneNumber}</Text> : null}
                {customer.cnicOrPassport ? <Text style={styles.metaText}>CNIC / Passport: {customer.cnicOrPassport}</Text> : null}
                {customer.address ? <Text style={styles.metaText}>Address: {customer.address}</Text> : null}
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
    customerCard: {
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
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
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
