import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  AsyncList,
  Banner,
  Button,
  Card,
  InfoRow,
  Screen,
  StatusPill,
  statusLabel,
  useToast,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatDateRange, formatMoney } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { useNotificationsAction } from "../../../hooks/useHeaderActions";
import { errorMessage } from "../../../services/apiClient";
import {
  agreementStage,
  getMyAgreements,
  isAgreementSignable,
  isAgreementSuperseded,
  openMyAgreementPdf,
  openMySignedAgreementPdf,
  type AgreementRecord,
} from "../../../services/agreementService";
import { GuestState } from "./shared/GuestState";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

const STAGE_TEXT: Record<string, string> = {
  sign: "Read the agreement, then sign it electronically. Your booking is created as soon as you sign.",
  review: "Your signed agreement is with our team. We will verify it and confirm your booking.",
  booked: "Signed. Your booking has been created.",
};

/**
 * My Agreements (tab), like the website: agreements the team sent me. Read the PDF, sign electronically
 * (draw or type), see the signed copy, and see when the booking is created. Uploading a scanned signed PDF
 * needs a file picker the app doesn't have yet, so that option points to worknestpk.com.
 */
export default function AgreementListScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const bell = useNotificationsAction();
  const toast = useToast();

  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setAgreements([]);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        const rows = await getMyAgreements();
        setAgreements(rows.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)));
      } catch (err) {
        setError(errorMessage(err, "Your agreements could not be loaded. Please try again."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  // Reload whenever the tab comes back into view (e.g. after signing).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openPdf = async (item: AgreementRecord, signed: boolean) => {
    if (item.id === undefined || busy) return;
    const key = `${item.id}-${signed ? "signed" : "pdf"}`;
    setBusy(key);
    try {
      if (signed) await openMySignedAgreementPdf(item.id);
      else await openMyAgreementPdf(item.id);
    } catch (err) {
      toast.error(errorMessage(err, "The agreement could not be opened. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  if (!user) {
    return (
      <Screen edges={["top", "left", "right"]}>
        <AppHeader variant="brand" title="Agreements" />
        <GuestState
          illustration="document"
          title="Sign in to see your agreements"
          message="Lease agreements our team sends you appear here, ready to read and sign."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "left", "right"]}>
      <AppHeader variant="brand" title="Agreements" actions={bell} />
      <AsyncList
        data={agreements}
        keyExtractor={(a) => String(a.id)}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        error={error}
        empty={{
          illustration: "document",
          title: "No agreements yet",
          message: "After you accept a quotation, our team sends the lease agreement here.",
          actionLabel: "My quotations",
          onAction: () => navigation.navigate("QuotationList"),
        }}
        renderItem={({ item }) => {
          const stage = agreementStage(item);
          const superseded = isAgreementSuperseded(item, agreements);
          const signable = isAgreementSignable(item, agreements);
          const hasSigned = stage === "review" || stage === "booked";
          return (
            <Card>
              <View style={styles.titleRow}>
                <AppText variant="subheading" numberOfLines={1} style={styles.flex}>
                  {item.spaceName || `Agreement #${item.id}`}
                </AppText>
                <StatusPill status={superseded ? "Inactive" : String(item.status ?? "")} label={superseded ? "Replaced" : statusLabel(String(item.status ?? ""))} />
              </View>
              <AppText variant="caption" color="textMuted">
                Agreement #{item.id}
                {item.quotationNumber ? `  ·  Quotation ${item.quotationNumber}` : ""}
              </AppText>
              <View style={styles.rows}>
                {item.locationName ? <InfoRow label="Location" value={String(item.locationName)} icon="location-outline" /> : null}
                {item.contractStartDate ? (
                  <InfoRow label="Contract" value={formatDateRange(item.contractStartDate, item.contractEndDate)} icon="calendar-outline" />
                ) : null}
                {item.feeAmount ? <InfoRow label="Fee" value={formatMoney(item.feeAmount)} /> : null}
                {item.securityDeposit ? <InfoRow label="Security deposit" value={formatMoney(item.securityDeposit)} /> : null}
                {item.sentAt ? <InfoRow label="Sent" value={formatDate(String(item.sentAt))} /> : null}
              </View>

              {superseded ? (
                <Banner tone="info" message="A newer version of this agreement was sent to you. Please sign the latest one." />
              ) : STAGE_TEXT[stage] ? (
                <AppText variant="bodySmall" color="textSecondary" style={styles.stageText}>
                  {STAGE_TEXT[stage]}
                </AppText>
              ) : null}

              <View style={styles.actions}>
                {signable ? (
                  <Button
                    title="Sign electronically"
                    size="sm"
                    leftIcon="create-outline"
                    onPress={() =>
                      navigation.navigate("ESignAgreement", {
                        agreementId: item.id!,
                        quotationNumber: item.quotationNumber || undefined,
                        customerName: item.customerName || undefined,
                      })
                    }
                  />
                ) : null}
                <Button
                  title="Read agreement"
                  size="sm"
                  variant="secondary"
                  leftIcon="document-text-outline"
                  loading={busy === `${item.id}-pdf`}
                  onPress={() => openPdf(item, false)}
                />
                {hasSigned ? (
                  <Button
                    title="Signed copy"
                    size="sm"
                    variant="outline"
                    leftIcon="download-outline"
                    loading={busy === `${item.id}-signed`}
                    onPress={() => openPdf(item, true)}
                  />
                ) : null}
                {stage === "booked" ? (
                  <Button
                    title="My bookings"
                    size="sm"
                    variant="ghost"
                    rightIcon="chevron-forward"
                    onPress={() => navigation.navigate("MainTabs", { screen: "Bookings" })}
                  />
                ) : null}
              </View>
              {signable ? (
                <AppText variant="caption" color="textMuted" style={styles.stageText}>
                  Prefer to sign on paper? Print it, sign it and upload the scan on worknestpk.com (My Agreements).
                  Uploading from the app is coming soon.
                </AppText>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flex: { flex: 1 },
    rows: { marginTop: t.spacing.sm },
    stageText: { marginTop: t.spacing.sm },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, marginTop: t.spacing.md },
  });
