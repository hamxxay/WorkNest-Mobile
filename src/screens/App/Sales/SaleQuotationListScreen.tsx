import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../../components/Header";
import { Screen } from "../../../components/Screen";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../../theme";
import { getQuotations, type QuotationRecord } from "../../../services/quotationService";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  draft:     { label: "Draft",      bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.35)", text: "#64748b" },
  sent:      { label: "Sent",       bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.35)",  text: "#2563eb" },
  active:    { label: "Active",     bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.35)",  text: "#059669" },
  accepted:  { label: "Accepted",   bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.35)",  text: "#059669" },
  approved:  { label: "Approved",   bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.35)",  text: "#059669" },
  converted: { label: "Converted",  bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.35)",  text: "#059669" },
  declined:  { label: "Declined",   bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.35)",   text: "#dc2626" },
  rejected:  { label: "Rejected",   bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.35)",   text: "#dc2626" },
  pending:   { label: "Pending",    bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.35)",  text: "#d97706" },
  expired:   { label: "Expired",    bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.35)",  text: "#d97706" },
  inactive:  { label: "Inactive",   bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.35)", text: "#64748b" },
};

function getStatusCfg(status?: string) {
  return STATUS_CONFIG[(status ?? "").toLowerCase()] ?? STATUS_CONFIG.draft;
}

function formatDate(raw?: string) {
  if (!raw) return "—";
  return raw.split("T")[0];
}

const PAGE_LIMIT = 20;

// ─── Component ────────────────────────────────────────────────────────────────
export default function SaleQuotationListScreen({ navigation }: { navigation: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadQuotations = useCallback(
    async (isRefresh = false, currentPage = 1, currentSearch = search) => {
      if (isRefresh) {
        setRefreshing(true);
        setPage(1);
        currentPage = 1;
      } else if (currentPage === 1) {
        setLoading(true);
      }
      setError("");
      try {
        const result = await getQuotations(currentPage, PAGE_LIMIT, currentSearch || undefined);
        if (currentPage === 1) {
          setQuotations(result.data);
        } else {
          setQuotations(prev => [...prev, ...result.data]);
        }
        setTotal(result.total);
        setPage(currentPage);
      } catch (err) {
        console.warn("Failed to load quotations", err);
        setError(err instanceof Error ? err.message : "Failed to load quotations.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [search]
  );

  useEffect(() => {
    loadQuotations(false, 1, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function handleSearch() {
    setSearch(searchInput.trim());
  }

  function handleLoadMore() {
    if (loadingMore || quotations.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    loadQuotations(false, nextPage, search);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Screen>
      <Header />

      {/* Title row */}
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

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search by customer, space…"
            placeholderTextColor={colors.mutedForeground}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchInput.length > 0 && (
            <Pressable onPress={() => { setSearchInput(""); setSearch(""); }}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Summary chip */}
      {total > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{total} quotation{total !== 1 ? "s" : ""} found</Text>
        </View>
      )}

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading quotations…</Text>
        </View>
      ) : (
        <FlatList
          data={quotations}
          keyExtractor={(q, i) => String(q.id ?? `q-${i}`)}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadQuotations(true)}
              colors={[colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="document-outline" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No quotations found.</Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => navigation.navigate("QuotationCreate")}
              >
                <Text style={styles.emptyActionText}>Create a quotation</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = getStatusCfg(item.status);
            const name = item.customerName || `Customer #${item.customerId ?? "—"}`;
            const space = item.spaceName || (item.spaceId ? `Space #${item.spaceId}` : "");
            const total = Number(item.totalAmount ?? item.total ?? 0);

            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate("Quotation", { quotationId: String(item.id) })}
              >
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.cardNumber}>
                      {item.quotationNumber || `#${item.id}`}
                    </Text>
                    <Text style={styles.cardCustomer}>{name}</Text>
                    {!!space && <Text style={styles.cardMeta}>{space}</Text>}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                    <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Meta row */}
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{formatDate(item.quotationDate as string)}</Text>
                  {item.validUntil ? (
                    <>
                      <View style={styles.metaDot} />
                      <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                      <Text style={styles.metaText}>Valid till {formatDate(item.validUntil as string)}</Text>
                    </>
                  ) : null}
                  <View style={styles.metaSpacer} />
                  <Text style={styles.cardTotal}>PKR {total.toLocaleString()}</Text>
                </View>

                {/* Version chip */}
                {Number(item.version) > 1 && (
                  <View style={styles.versionChip}>
                    <Ionicons name="git-branch-outline" size={11} color={colors.primary} />
                    <Text style={styles.versionText}>v{item.version}</Text>
                  </View>
                )}

                {/* Action row */}
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.actionChip}
                    onPress={() => navigation.navigate("Quotation", { quotationId: String(item.id) })}
                  >
                    <Ionicons name="eye-outline" size={13} color={colors.primary} />
                    <Text style={styles.actionChipText}>View</Text>
                  </Pressable>
                  {(item.status === "draft" || item.status === "active" || item.status === "pending") && (
                    <Pressable
                      style={[styles.actionChip, styles.actionChipPrimary]}
                      onPress={() => navigation.navigate("QuotationCreate", { editQuotationId: String(item.id) })}
                    >
                      <Ionicons name="create-outline" size={13} color="#fff" />
                      <Text style={[styles.actionChipText, styles.actionChipTextPrimary]}>Edit</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    headerWrap: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 10,
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
    eyebrow: { fontSize: 10, letterSpacing: 1, color: colors.primary, fontWeight: "800" },
    title: { fontSize: 22, fontWeight: "900", color: colors.foreground, letterSpacing: -0.5 },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    newBtnText: { color: colors.white, fontWeight: "700", fontSize: 12 },

    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 18,
      paddingBottom: 10,
    },
    searchWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchInput: { flex: 1, fontSize: 13, minHeight: 36 },
    searchBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
    },
    searchBtnText: { color: colors.white, fontWeight: "700", fontSize: 12 },

    summaryRow: { paddingHorizontal: 18, paddingBottom: 6 },
    summaryText: { color: colors.mutedForeground, fontSize: 12 },

    errorBox: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      marginHorizontal: 18,
      marginBottom: 8,
      backgroundColor: colors.dangerMuted,
      borderRadius: radii.md,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: 13 },

    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 60 },
    loadingText: { color: colors.mutedForeground, fontSize: 14 },

    listContainer: { paddingHorizontal: 18, paddingBottom: 32, gap: 12 },
    footerLoader: { paddingVertical: 20, alignItems: "center" },

    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 32,
      alignItems: "center",
      gap: 12,
      marginTop: 20,
    },
    emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: "center" },
    emptyAction: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    emptyActionText: { color: colors.primary, fontWeight: "700", fontSize: 12 },

    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
      ...shadows.sm,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    cardHeaderLeft: { flex: 1, gap: 2, marginRight: 10 },
    cardNumber: { color: colors.mutedForeground, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
    cardCustomer: { color: colors.foreground, fontSize: 15, fontWeight: "800" },
    cardMeta: { color: colors.mutedForeground, fontSize: 12 },
    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    statusText: { fontSize: 11, fontWeight: "700" },

    metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaText: { color: colors.mutedForeground, fontSize: 12 },
    metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.mutedForeground },
    metaSpacer: { flex: 1 },
    cardTotal: { color: colors.primary, fontSize: 14, fontWeight: "800" },

    versionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    versionText: { color: colors.primary, fontSize: 11, fontWeight: "700" },

    actionsRow: { flexDirection: "row", gap: 8 },
    actionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    actionChipPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionChipText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    actionChipTextPrimary: { color: "#fff" },
  });
