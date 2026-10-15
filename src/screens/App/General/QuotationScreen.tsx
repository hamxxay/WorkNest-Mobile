import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Banner,
  BottomSheet,
  Button,
  Card,
  Divider,
  ErrorState,
  InfoRow,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  StatusPill,
  TextField,
  useConfirm,
  useToast,
} from "../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatMoney } from "../../../utils/format";
import {
  acceptQuotation,
  canRespondToQuotation,
  quotationDisplayStatus,
  declineQuotation,
  getQuotationActivities,
  getQuotationById,
  getQuotationVersions,
  openQuotationPdf,
  type Quotation,
  type QuotationActivity,
} from "../../../services/customerQuotationService";
import { errorMessage } from "../../../services/apiClient";
import type { AppStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { splitBreakdown } from "../../../services/amountBreakdown";
import { AmountBreakdown } from "./shared/AmountBreakdown";

/**
 * One quotation. Shared with the sales stack: customers (role general) can accept or decline (a reason is
 * required); staff see the activity log instead. Everyone can download the PDF.
 */
export default function QuotationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Quotation">>();
  const { quotationId } = route.params;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const confirm = useConfirm();
  const { user, isLoadingUser, role } = useAuth();
  const isCustomer = role === "general";

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [versions, setVersions] = useState<Quotation[]>([]);
  const [activities, setActivities] = useState<QuotationActivity[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [declineError, setDeclineError] = useState("");
  const [declining, setDeclining] = useState(false);

  // Customer app: a signed-out visitor (deep link) signs in first, then comes back here.
  useEffect(() => {
    if (!isLoadingUser && !user) {
      navigation.replace("Login", { redirectAfterLogin: { screen: "Quotation", params: { quotationId } } });
    }
  }, [isLoadingUser, user, navigation, quotationId]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        setQuotation(await getQuotationById(quotationId));
      } catch (e) {
        setError(errorMessage(e, "The quotation could not be loaded. Please try again."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
      // Versions for everyone; activities are a staff endpoint.
      const [v, a] = await Promise.allSettled([
        getQuotationVersions(quotationId),
        isCustomer ? Promise.resolve([] as QuotationActivity[]) : getQuotationActivities(quotationId),
      ]);
      if (v.status === "fulfilled") setVersions(v.value);
      if (a.status === "fulfilled") setActivities(a.value);
    },
    [quotationId, isCustomer],
  );

  useEffect(() => {
    if (isLoadingUser || !user) return;
    load();
  }, [load, isLoadingUser, user]);

  const openPdf = async () => {
    if (!quotation || pdfBusy) return;
    setPdfBusy(true);
    try {
      await openQuotationPdf(quotation.id, quotation.quotationNumber);
    } catch (e) {
      toast.error(errorMessage(e, "The quotation PDF could not be downloaded. Please try again."));
    } finally {
      setPdfBusy(false);
    }
  };

  const accept = async () => {
    if (!quotation) return;
    try {
      const ok = await confirm({
        title: "Accept this quotation?",
        message: "Our team will then send you the lease agreement to sign.",
        confirmLabel: "Accept",
        icon: "checkmark-circle-outline",
        onConfirm: () => acceptQuotation(quotationId, undefined, quotation.version),
      });
      if (!ok) return;
      toast.success("Quotation accepted. Watch for your agreement under Agreements.");
      load(true);
    } catch (e) {
      toast.error(errorMessage(e, "The quotation could not be accepted. Please try again."));
    }
  };

  const decline = async () => {
    if (!quotation || declining) return;
    if (!declineNote.trim()) {
      setDeclineError("Please tell us why you are declining.");
      return;
    }
    setDeclining(true);
    setDeclineError("");
    try {
      await declineQuotation(quotationId, declineNote.trim(), quotation.version);
      setDeclineOpen(false);
      setDeclineNote("");
      toast.success("Quotation declined. Thank you for letting us know.");
      load(true);
    } catch (e) {
      setDeclineError(errorMessage(e, "The quotation could not be declined. Please try again."));
    } finally {
      setDeclining(false);
    }
  };

  const status = (quotation?.status ?? "").toLowerCase();
  // The API decides (canRespond: only while the quotation is Sent); see canRespondToQuotation.
  const actionable = !!quotation && isCustomer && canRespondToQuotation(quotation);
  // The API's breakdown (advance rent, deposit, tax...) adds up to the total; the contract items do not.
  const hasBreakdown = !!quotation && splitBreakdown(quotation.fields).amounts.length > 0;
  const accepted = status === "accepted" || status === "approved";
  const declined = status === "declined" || status === "rejected";

  return (
    <Screen>
      <AppHeader
        title={quotation?.quotationNumber ? `Quotation ${quotation.quotationNumber}` : "Quotation"}
        actions={quotation ? [{ icon: "download-outline", accessibilityLabel: "Download quotation PDF", onPress: openPdf, disabled: pdfBusy }] : []}
      />
      {loading ? (
        <LoadingState message="Loading quotation" />
      ) : error || !quotation ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor={colors.surfaceRaised}
            />
          }
        >
          <Card>
            <View style={styles.titleRow}>
              <AppText variant="overline" color="textMuted" style={styles.flex}>
                {quotation.customerName || "Quotation"}
              </AppText>
              <StatusPill status={quotationDisplayStatus(quotation)} size="md" />
            </View>
            <AppText variant="display" style={styles.total}>
              {formatMoney(quotation.total)}
            </AppText>
            <InfoRow label="Issued" value={formatDate(quotation.quotationDate)} icon="calendar-outline" />
            <InfoRow label="Valid until" value={formatDate(quotation.validUntil)} icon="time-outline" />
            {quotation.spaceName || quotation.spaceTypeName ? (
              <InfoRow label="Space" value={quotation.spaceName || quotation.spaceTypeName || ""} icon="business-outline" />
            ) : null}
            {quotation.locationName ? <InfoRow label="Location" value={quotation.locationName} icon="location-outline" /> : null}
            {quotation.startDateTime ? (
              <InfoRow label="Period" value={`${formatDate(quotation.startDateTime)} to ${formatDate(quotation.endDateTime)}`} />
            ) : null}
          </Card>

          {hasBreakdown ? (
            <AmountBreakdown fields={quotation.fields} totalValue={formatMoney(quotation.total)} />
          ) : (
            <>
              {/* Older API without `fields`: the quotation's items and totals as sent. */}
              <SectionHeader title="Items" />
              <Card>
                {quotation.items.length === 0 ? (
                  <AppText variant="bodySmall" color="textMuted">
                    No item breakdown on this quotation.
                  </AppText>
                ) : (
                  quotation.items.map((item, i) => (
                    <InfoRow
                      key={`${item.id}-${i}`}
                      label={`${item.name}${item.quantity > 1 ? ` x ${item.quantity}` : ""}`}
                      value={formatMoney(item.total)}
                    />
                  ))
                )}
                <Divider spacing={8} />
                {quotation.tax > 0 ? <InfoRow label="Subtotal" value={formatMoney(quotation.subtotal)} /> : null}
                {quotation.discountAmount ? (
                  <InfoRow label="Discount" value={`- ${formatMoney(quotation.discountAmount)}`} />
                ) : null}
                {quotation.tax > 0 ? <InfoRow label="Tax" value={formatMoney(quotation.tax)} /> : null}
                {quotation.securityDeposit ? (
                  <InfoRow label="Security deposit" value={formatMoney(quotation.securityDeposit)} />
                ) : null}
                <InfoRow label="Total" value={formatMoney(quotation.total)} emphasize />
              </Card>
            </>
          )}

          {quotation.notes ? <Banner tone="info" title="Notes" message={quotation.notes} /> : null}

          {actionable ? (
            <View style={styles.actions}>
              <Button title="Accept quotation" leftIcon="checkmark" size="lg" fullWidth onPress={accept} />
              <Button title="Decline" variant="outline" leftIcon="close" fullWidth onPress={() => setDeclineOpen(true)} />
            </View>
          ) : accepted && isCustomer ? (
            <Banner
              tone="success"
              title="Accepted"
              message="Our team will send you the lease agreement. Sign it under Agreements; your booking and its challan follow."
              actionLabel="Open Agreements"
              onAction={() => navigation.navigate("MainTabs", { screen: "Agreements" })}
            />
          ) : declined && isCustomer ? (
            <Banner tone="danger" title="Declined" message="You declined this quotation. Contact us if you would like a new one." />
          ) : quotation.expired ? (
            <Banner
              tone="warning"
              title="Expired"
              message={`This quotation was valid until ${formatDate(quotation.validUntil)}, so it can no longer be accepted or declined. Ask our team for a new quotation.`}
              actionLabel={isCustomer ? "Contact us" : undefined}
              onAction={isCustomer ? () => navigation.navigate("ContactUs") : undefined}
            />
          ) : null}

          {versions.length > 1 ? (
            <>
              <SectionHeader title="Versions" />
              <Card padding={0}>
                {versions.map((v, i) => (
                  <View key={`${v.id}-${v.version}-${i}`}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow title={`Version ${v.version ?? 1}`} subtitle={formatMoney(v.total)} right={<StatusPill status={v.status} />} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {!isCustomer && activities.length > 0 ? (
            <>
              <SectionHeader title="Recent activity" />
              <Card padding={0}>
                {activities.slice(0, 5).map((a, i) => (
                  <View key={a.id || `${a.action}-${i}`}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow title={a.action} subtitle={a.description} meta={a.createdAt ? formatDate(a.createdAt) : undefined} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </ScrollView>
      )}

      <BottomSheet
        visible={declineOpen}
        onClose={() => !declining && setDeclineOpen(false)}
        dismissible={!declining}
        title="Decline quotation"
        subtitle="A short reason helps our team send you a better offer."
        footer={
          <>
            <Button title="Back" variant="outline" style={styles.flex} disabled={declining} onPress={() => setDeclineOpen(false)} />
            <Button title="Decline" variant="danger" style={styles.flex} loading={declining} onPress={decline} />
          </>
        }
      >
        <TextField
          label="Reason"
          required
          value={declineNote}
          onChangeText={(v) => {
            setDeclineNote(v);
            setDeclineError("");
          }}
          multiline
          rows={4}
          maxLength={500}
          error={declineError}
          placeholder="For example: the price is above our budget"
        />
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flex: { flex: 1 },
    total: { marginVertical: t.spacing.sm },
    actions: { gap: t.spacing.md },
  });
