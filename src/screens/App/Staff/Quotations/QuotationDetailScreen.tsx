import { Fragment, useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  ErrorState,
  InfoRow,
  ListRow,
  ListSkeleton,
  SectionHeader,
  StatusPill,
  SuccessOverlay,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  createQuotationVersion,
  downloadQuotationPdf,
  emailQuotation,
  getQuotation,
  getQuotationVersions,
  sendQuotation,
  type StaffQuotation,
} from "../../../../services/staff";
import { normalizeStatus, spacing, useThemeColors } from "../../../../theme";
import { formatDate, formatDateRange, formatDateTime, formatMoney } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";
import { useAsyncData } from "../shared/hooks";
import { useOpenFile } from "../shared/useOpenFile";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "QuotationDetail">;

/** Statuses after which a quotation can no longer be sent again (agreement stage or later). */
const CLOSED = new Set(["signed", "converted", "inactive", "agreementsent"]);

/**
 * One quotation version (GET quotation/{id}) with its versions (GET quotation/{id}/versions): send it to the
 * customer, email the PDF, open the PDF, make a new version, "edit" (= new prefilled quotation) and, once
 * accepted, send the lease agreement.
 */
export default function QuotationDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const colors = useThemeColors();
  const { opening, open } = useOpenFile();

  const fetcher = useCallback(async () => {
    const quotation = await getQuotation(params.quotationId);
    let versions: StaffQuotation[] = [];
    try {
      versions = await getQuotationVersions(params.quotationId);
    } catch {
      versions = [];
    }
    return { quotation, versions };
  }, [params.quotationId]);
  const { data, loading, refreshing, error, reload, refresh } = useAsyncData(fetcher, { reloadOnFocus: true });

  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmVersion, setConfirmVersion] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Errors of an action started from a dialog are shown in the dialog (toasts render under modals).
  const [dialogError, setDialogError] = useState<string | null>(null);
  // "Quotation sent" / "Quotation emailed" moment: shown in the success overlay.
  const [sent, setSent] = useState<{ title: string; message: string } | null>(null);

  const q = data?.quotation;
  const status = normalizeStatus(q?.status);

  const send = async () => {
    if (!q) return;
    setBusy("send");
    setDialogError(null);
    try {
      const result = await sendQuotation(q.id, q.version);
      setConfirmSend(false);
      setSent({ title: "Quotation sent", message: result.message });
      refresh();
    } catch (err) {
      setDialogError(errorMessage(err, "Could not send the quotation."));
    } finally {
      setBusy(null);
    }
  };

  const newVersion = async () => {
    if (!q) return;
    setBusy("version");
    setDialogError(null);
    try {
      const result = await createQuotationVersion(q.id);
      toast.success(result.message);
      setConfirmVersion(false);
      if (result.data.id > 0) navigation.replace("QuotationDetail", { quotationId: result.data.id });
      else refresh();
    } catch (err) {
      setDialogError(errorMessage(err, "Could not create a new version."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <StaffScreen>
      <AppHeader
        title={q?.quotationNumber || "Quotation"}
        subtitle={q ? `Version ${q.version}` : undefined}
        actions={
          q
            ? [
                {
                  icon: "document-outline",
                  accessibilityLabel: "Open PDF",
                  disabled: opening === "pdf",
                  onPress: () =>
                    open("pdf", () => downloadQuotationPdf(q.id, { versionNumber: q.version, quotationNumber: q.quotationNumber }), q.quotationNumber),
                },
              ]
            : undefined
        }
      />
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : q && data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="heading" numberOfLines={2}>
                  {q.customerName || "Customer"}
                </AppText>
                {q.customerCompany ? (
                  <AppText variant="bodySmall" color="textMuted">
                    {q.customerCompany}
                  </AppText>
                ) : null}
              </View>
              <StatusPill status={q.status} size="md" />
            </View>
            <Divider spacing={10} />
            {q.customerEmail ? <InfoRow label="Email" value={q.customerEmail} icon="mail-outline" /> : null}
            <InfoRow label="Space" value={[q.spaceName, q.spaceCode].filter(Boolean).join(" · ") || "—"} icon="business-outline" />
            <InfoRow label="Location" value={q.locationName || "—"} icon="location-outline" />
            {q.offeringType ? <InfoRow label="Offering" value={q.offeringType} icon="time-outline" /> : null}
            <InfoRow label="Period" value={formatDateRange(q.startDateTime, q.endDateTime)} icon="calendar-outline" />
            <InfoRow label="Valid until" value={formatDate(q.validUntil)} icon="hourglass-outline" />
            {q.quotationDate ? <InfoRow label="Created" value={formatDate(q.quotationDate)} /> : null}
          </Card>

          <SectionHeader title="Amounts" variant="overline" />
          <Card>
            {q.capacity ? <InfoRow label="Seats" value={String(q.capacity)} /> : null}
            {q.perSeatBasePrice ? <InfoRow label="Price per seat / month" value={formatMoney(q.perSeatBasePrice)} /> : null}
            {q.monthlyRent ? <InfoRow label="Monthly rent" value={formatMoney(q.monthlyRent)} /> : null}
            <InfoRow label="Subtotal" value={formatMoney(q.subtotalAmount)} />
            {q.discountAmount ? (
              <InfoRow
                label={q.discountPercentage ? `Discount (${q.discountPercentage}%)` : "Discount"}
                value={`- ${formatMoney(q.discountAmount)}`}
                valueColor="success"
              />
            ) : null}
            {q.supportChargeAmount ? <InfoRow label="Support charges" value={formatMoney(q.supportChargeAmount)} /> : null}
            {q.taxAmount ? <InfoRow label="Tax" value={formatMoney(q.taxAmount)} /> : null}
            {q.whtAmount ? <InfoRow label="Withholding tax" value={formatMoney(q.whtAmount)} /> : null}
            {q.securityDeposit ? (
              <InfoRow
                label={q.securityDepositMonths ? `Security deposit (${q.securityDepositMonths} months)` : "Security deposit"}
                value={formatMoney(q.securityDeposit)}
              />
            ) : null}
            <Divider spacing={8} />
            <InfoRow label="Total payable" value={formatMoney(q.totalPayable || q.totalAmount)} emphasize />
            {q.billingPeriodLabel || q.billingPeriodMonths ? (
              <InfoRow label="Billing" value={q.billingPeriodLabel || `Every ${q.billingPeriodMonths} months`} />
            ) : null}
            {q.totalContractAmount ? <InfoRow label="Contract value" value={formatMoney(q.totalContractAmount)} /> : null}
          </Card>

          {q.remarks || q.customerNote ? (
            <Card>
              {q.remarks ? <InfoRow label="Remarks" value={q.remarks} layout="stacked" /> : null}
              {q.customerNote ? (
                <InfoRow
                  label={`Customer note${q.responseDate ? `, ${formatDate(q.responseDate)}` : ""}`}
                  value={q.customerNote}
                  layout="stacked"
                />
              ) : null}
            </Card>
          ) : null}

          <View style={styles.actions}>
            {status === "accepted" ? (
              <Button
                title="Send agreement"
                leftIcon="document-attach-outline"
                onPress={() => navigation.navigate("AgreementSend", { quotationId: q.id })}
                fullWidth
              />
            ) : null}
            {!CLOSED.has(status) && status !== "accepted" ? (
              <Button title="Send to customer" leftIcon="paper-plane-outline" onPress={() => setConfirmSend(true)} fullWidth haptic />
            ) : null}
            <View style={styles.row}>
              <Button title="Email PDF" variant="outline" leftIcon="mail-outline" onPress={() => setEmailOpen(true)} style={styles.flex} />
              <Button
                title="Open PDF"
                variant="outline"
                leftIcon="document-outline"
                loading={opening === "pdf"}
                onPress={() =>
                  open("pdf", () => downloadQuotationPdf(q.id, { versionNumber: q.version, quotationNumber: q.quotationNumber }), q.quotationNumber)
                }
                style={styles.flex}
              />
            </View>
            <View style={styles.row}>
              <Button title="New version" variant="secondary" leftIcon="copy-outline" onPress={() => setConfirmVersion(true)} style={styles.flex} />
              <Button
                title="Edit as new"
                variant="secondary"
                leftIcon="create-outline"
                onPress={() => navigation.navigate("QuotationForm", { editFromId: q.id })}
                style={styles.flex}
              />
            </View>
          </View>

          {data.versions.length > 1 ? (
            <>
              <SectionHeader title="Versions" variant="overline" />
              <Card padding={0}>
                {data.versions.map((v, i) => (
                  <Fragment key={v.id}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      title={`Version ${v.version}`}
                      subtitle={`${formatMoney(v.totalPayable || v.totalAmount)} · ${formatDate(v.quotationDate)}`}
                      right={<StatusPill status={v.status} />}
                      onPress={v.id === q.id ? undefined : () => navigation.push("QuotationDetail", { quotationId: v.id })}
                      chevron={v.id !== q.id}
                      accessibilityLabel={`Version ${v.version}${v.id === q.id ? ", showing" : ""}`}
                    />
                  </Fragment>
                ))}
              </Card>
            </>
          ) : null}

          {q.activities.length ? (
            <>
              <SectionHeader title="Activity" variant="overline" />
              <Card padding={0}>
                {q.activities.map((a, i) => (
                  <Fragment key={a.id || i}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      title={a.message || a.activityType}
                      subtitle={[a.customerNote, a.createdDate ? formatDateTime(a.createdDate) : null].filter(Boolean).join(" · ")}
                      titleLines={2}
                    />
                  </Fragment>
                ))}
              </Card>
            </>
          ) : null}
        </ScrollView>
      ) : null}

      <ConfirmDialog
        error={dialogError}
        visible={confirmSend}
        title="Send this quotation?"
        message="The customer can then accept or decline it in the WorkNest app and website."
        confirmLabel="Send"
        icon="paper-plane-outline"
        loading={busy === "send"}
        onCancel={() => {
          setConfirmSend(false);
          setDialogError(null);
        }}
        onConfirm={send}
       />
      <ConfirmDialog
        error={dialogError}
        visible={confirmVersion}
        title="Create a new version?"
        message="A draft copy of this quotation is made as the next version."
        confirmLabel="Create version"
        icon="copy-outline"
        loading={busy === "version"}
        onCancel={() => {
          setConfirmVersion(false);
          setDialogError(null);
        }}
        onConfirm={newVersion}
       />
      {q && emailOpen ? (
        <EmailSheet
          quotation={q}
          onClose={() => setEmailOpen(false)}
          onSent={(message) => {
            setEmailOpen(false);
            setSent({ title: "Quotation emailed", message });
          }}
        />
      ) : null}
      <SuccessOverlay visible={!!sent} title={sent?.title ?? ""} message={sent?.message} onHidden={() => setSent(null)} />
    </StaffScreen>
  );
}

function EmailSheet({ quotation, onClose, onSent }: { quotation: StaffQuotation; onClose: () => void; onSent: (m: string) => void }) {
  const [email, setEmail] = useState(quotation.customerEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const submit = async () => {
    const value = email.trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("Enter a valid email address.");
    setSending(true);
    setError(null);
    try {
      onSent((await emailQuotation(quotation.id, value || null)).message);
    } catch (err) {
      setError(errorMessage(err, "Could not email the quotation."));
    } finally {
      setSending(false);
    }
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      dismissible={!sending}
      title="Email quotation"
      subtitle="WorkNest attaches the quotation PDF."
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={sending} style={styles.flex} />
          <Button title="Send email" leftIcon="mail-outline" onPress={submit} loading={sending} style={styles.flex} haptic />
        </>
      }
    >
      <TextField
        label="Send to"
        value={email}
        onChangeText={(t) => {
          setEmail(t.trim());
          if (error) setError(null);
        }}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        leftIcon="mail-outline"
        helperText="Leave empty to use the customer's email."
        returnKeyType="send"
        onSubmitEditing={submit}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  actions: { gap: spacing.sm },
});
