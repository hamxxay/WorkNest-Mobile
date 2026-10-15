import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, InfoRow, Screen, StatusPill } from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatMoney } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { errorMessage } from "../../../services/apiClient";
import {
  canRespondToQuotation,
  getMyQuotations,
  quotationDisplayStatus,
  type Quotation,
} from "../../../services/customerQuotationService";
import { GuestState } from "./shared/GuestState";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Statuses a customer should act on first. */
const ORDER = ["sent", "active", "pending", "approved", "accepted", "converted", "rejected", "declined", "expired", "inactive", "draft"];

/** My quotations (GET /quotation/my). Open one to read it, download the PDF, accept or decline. */
export default function QuotationListScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        const data = await getMyQuotations();
        const rank = (q: Quotation) => {
          const i = ORDER.indexOf(quotationDisplayStatus(q).toLowerCase());
          return i === -1 ? 99 : i;
        };
        setQuotations(data.sort((a, b) => rank(a) - rank(b) || Number(b.id) - Number(a.id)));
      } catch (err) {
        setError(errorMessage(err, "Your quotations could not be loaded. Please try again."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = (q: Quotation) => {
    const routeId = String(q.id ?? "").match(/\d+/)?.[0] ?? String(q.id);
    navigation.navigate("Quotation", { quotationId: routeId });
  };

  return (
    <Screen>
      <AppHeader title="My quotations" />
      {!user ? (
        <GuestState illustration="document" title="Sign in to see your quotations" message="Quotations from our sales team appear here." />
      ) : (
        <AsyncList
          data={quotations}
          keyExtractor={(q) => String(q.id)}
          loading={loading}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          error={error}
          empty={{
            illustration: "document",
            title: "No quotations yet",
            message: "Book a tour or contact us and our sales team will send you a quotation.",
            actionLabel: "Book a tour",
            onAction: () => navigation.navigate("BookTour"),
          }}
          renderItem={({ item }) => {
            const respond = canRespondToQuotation(item);
            return (
              <Card
                onPress={() => open(item)}
                accessibilityLabel={`Quotation ${item.quotationNumber || item.id}, ${quotationDisplayStatus(item)}`}
              >
                <View style={styles.titleRow}>
                  <AppText variant="subheading" numberOfLines={1} style={styles.flex}>
                    {item.quotationNumber || `Quotation #${item.id}`}
                  </AppText>
                  <StatusPill status={quotationDisplayStatus(item)} />
                </View>
                {item.spaceName || item.locationName ? (
                  <AppText variant="caption" color="textMuted" numberOfLines={1}>
                    {[item.spaceName, item.locationName].filter(Boolean).join("  ·  ")}
                  </AppText>
                ) : null}
                <View style={styles.rows}>
                  <InfoRow label="Total" value={formatMoney(item.total)} emphasize />
                  {item.quotationDate ? <InfoRow label="Date" value={formatDate(item.quotationDate)} /> : null}
                  {item.validUntil ? <InfoRow label="Valid until" value={formatDate(item.validUntil)} /> : null}
                </View>
                {respond ? (
                  <AppText variant="captionStrong" color="primary" style={styles.cta}>
                    Waiting for your answer: open to accept or decline
                  </AppText>
                ) : item.expired ? (
                  <AppText variant="caption" color="textMuted" style={styles.cta}>
                    Expired: ask our team for a new quotation
                  </AppText>
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flex: { flex: 1 },
    rows: { marginTop: t.spacing.sm },
    cta: { marginTop: t.spacing.sm },
  });
