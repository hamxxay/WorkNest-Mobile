import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  BottomSheet,
  Button,
  Card,
  Divider,
  ErrorState,
  InfoRow,
  ListSkeleton,
  SectionHeader,
  SelectField,
  StatusPill,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  PAYMENT_METHODS,
  downloadInvoicePdf,
  emailInvoice,
  getInvoice,
  recordInvoicePayment,
  validateRecordPayment,
  type PaymentMethod,
  type StaffInvoiceDetail,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatDateRange, formatMoney, formatNumber } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";
import { useAsyncData } from "../shared/hooks";
import { ActionRow, useStackedMeta } from "../shared/layout";
import { useOpenFile } from "../shared/useOpenFile";
import { useRefreshColors } from "../shared/refresh";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "InvoiceDetail">;

/**
 * One invoice (GET invoice/{id}) with its lines: statement PDF (login token), email to the customer, and Record
 * payment (cash, cheque, bank transfer...; part or full, as the CMS "Record Payment").
 */
export default function InvoiceDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const refreshColors = useRefreshColors();
  const { opening, open } = useOpenFile();
  const [emailing, setEmailing] = useState(false);
  const [paying, setPaying] = useState(false);
  // Large text on a narrow phone: the status pill goes under the name, line amounts under their details.
  const stacked = useStackedMeta();
  const fetcher = useCallback(() => getInvoice(params.invoiceId, params.invoice), [params.invoiceId, params.invoice]);
  const { data: inv, loading, refreshing, error, reload, refresh } = useAsyncData(fetcher);

  const sendEmail = async () => {
    if (!inv) return;
    setEmailing(true);
    try {
      toast.success((await emailInvoice(inv.id)).message);
    } catch (err) {
      toast.error(errorMessage(err, "Could not email the invoice."));
    } finally {
      setEmailing(false);
    }
  };

  return (
    <StaffScreen>
      <AppHeader title={inv?.invoiceNumber ?? "Invoice"} subtitle={inv?.invoiceType ?? undefined} />
      {loading && !inv ? (
        <ListSkeleton rows={4} />
      ) : error && !inv ? (
        <ErrorState message={error} onRetry={reload} />
      ) : inv ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />}
        >
          <Card>
            <View style={stacked ? styles.stack : styles.row}>
              <View style={stacked ? undefined : styles.flex}>
                <AppText variant="heading" numberOfLines={stacked ? 3 : 2}>
                  {inv.customerName || "Customer"}
                </AppText>
                {inv.customerEmail ? (
                  <AppText variant="bodySmall" color="textMuted">
                    {inv.customerEmail}
                  </AppText>
                ) : null}
              </View>
              <StatusPill status={inv.status} size="md" />
            </View>
            <Divider spacing={10} />
            {inv.spaceName ? <InfoRow label="Space" value={[inv.spaceName, inv.spaceCode].filter(Boolean).join(" · ")} icon="business-outline" /> : null}
            {inv.locationName ? <InfoRow label="Location" value={inv.locationName} icon="location-outline" /> : null}
            <InfoRow label="Issued" value={formatDate(inv.issuedOn)} icon="calendar-outline" />
            <InfoRow label="Due" value={formatDate(inv.dueOn)} icon="alarm-outline" />
            {inv.billingPeriodStart ? <InfoRow label="Billing period" value={formatDateRange(inv.billingPeriodStart, inv.billingPeriodEnd)} /> : null}
            {inv.bookingId ? (
              <InfoRow
                label="Booking"
                value={
                  <Button
                    title={`#${inv.bookingId}`}
                    variant="ghost"
                    size="sm"
                    rightIcon="chevron-forward"
                    onPress={() => navigation.navigate("BookingDetail", { bookingId: inv.bookingId as number })}
                  />
                }
              />
            ) : null}
          </Card>

          {inv.lines.length ? (
            <>
              <SectionHeader title="Lines" variant="overline" />
              <Card>
                {inv.lines.map((l, i) => (
                  <View key={l.id || i}>
                    {i > 0 ? <Divider spacing={8} /> : null}
                    <AppText variant="bodyStrong">{l.description || l.chargeTypeLabel || "Charge"}</AppText>
                    <View style={stacked ? styles.stack : styles.row}>
                      <AppText variant="caption" color="textMuted" style={stacked ? undefined : styles.flex}>
                        {formatNumber(l.quantity)} x {formatMoney(l.unitPrice)}
                        {l.taxRate ? ` · tax ${formatNumber(l.taxRate * (l.taxRate <= 1 ? 100 : 1))}%` : ""}
                      </AppText>
                      <AppText variant="bodySmall" numberOfLines={1} style={styles.shrink}>
                        {formatMoney(l.quantity * l.unitPrice - l.discountAmount)}
                      </AppText>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title="Amounts" variant="overline" />
          <Card>
            <InfoRow label="Subtotal" value={formatMoney(inv.subTotal)} />
            {inv.discountTotal ? <InfoRow label="Discount" value={`- ${formatMoney(inv.discountTotal)}`} valueColor="success" /> : null}
            {inv.taxTotal ? <InfoRow label="Tax" value={formatMoney(inv.taxTotal)} /> : null}
            {inv.securityDepositAmount ? <InfoRow label="Security deposit" value={formatMoney(inv.securityDepositAmount)} /> : null}
            <InfoRow label="Total" value={formatMoney(inv.grandTotal)} emphasize />
            {inv.whtAmount ? <InfoRow label="Withholding tax" value={`- ${formatMoney(inv.whtAmount)}`} /> : null}
            <InfoRow label="Paid" value={formatMoney(inv.paidTotal)} valueColor="success" />
            <Divider spacing={8} />
            <InfoRow label="Balance due" value={formatMoney(inv.balanceDue)} emphasize valueColor={inv.balanceDue > 0 ? "danger" : "success"} />
          </Card>
          {inv.notes ? (
            <Card>
              <InfoRow label="Notes" value={inv.notes} layout="stacked" />
            </Card>
          ) : null}

          <ActionRow>
            <Button
              title="Statement PDF"
              variant="outline"
              leftIcon="document-outline"
              loading={opening === "pdf"}
              onPress={() => open("pdf", () => downloadInvoicePdf(inv.id, inv.invoiceNumber), inv.invoiceNumber)}
            />
            <Button title="Email customer" leftIcon="mail-outline" loading={emailing} onPress={sendEmail} />
          </ActionRow>
          {canRecordPayment(inv) ? (
            <Button title="Record payment" leftIcon="cash-outline" onPress={() => setPaying(true)} fullWidth haptic />
          ) : null}
        </ScrollView>
      ) : null}
      {inv && paying ? (
        <RecordPaymentSheet
          invoice={inv}
          onClose={() => setPaying(false)}
          onDone={(message) => {
            setPaying(false);
            toast.success(message);
            // Detail now; the invoice list reloads by itself when the screen is shown again.
            refresh();
          }}
        />
      ) : null}
    </StaffScreen>
  );
}

/** Left on the invoice including the WHT part (the most that can be recorded). */
const leftToPay = (inv: StaffInvoiceDetail) => Math.max(0, Math.round((inv.grandTotal - inv.paidTotal) * 100) / 100);

/** Not paid in full and not cancelled. */
function canRecordPayment(inv: StaffInvoiceDetail): boolean {
  const label = inv.statusLabel.trim().toLowerCase();
  return label !== "paid" && label !== "cancelled" && leftToPay(inv) > 0;
}

const METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ label: m === "Online" ? "Online / portal" : m, value: m }));

function RecordPaymentSheet({ invoice, onClose, onDone }: { invoice: StaffInvoiceDetail; onClose: () => void; onDone: (message: string) => void }) {
  // Default: what is still to be paid in cash / bank, without the WHT the customer withholds for the tax office.
  const [amount, setAmount] = useState(invoice.balanceDue > 0 ? String(invoice.balanceDue) : "");
  const [method, setMethod] = useState<PaymentMethod>("Bank Transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const max = leftToPay(invoice);

  const submit = async () => {
    setError(null);
    const input = { paidAmount: Number(amount.replace(/,/g, "")), paymentMethod: method, transactionRef: reference, notes };
    const invalid = validateRecordPayment(input, max);
    if (invalid) {
      setAmountError(invalid);
      return;
    }
    setAmountError(null);
    setSaving(true);
    try {
      onDone((await recordInvoicePayment(invoice.id, input, max)).message);
    } catch (err) {
      setError(errorMessage(err, "Could not record the payment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      error={error}
      visible
      onClose={onClose}
      dismissible={!saving}
      title="Record payment"
      subtitle={`${invoice.invoiceNumber} · ${formatMoney(invoice.balanceDue)} due`}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Record payment" onPress={submit} loading={saving} style={styles.flex} haptic />
        </>
      }
    >
      <TextField
        label="Amount received (PKR)"
        required
        value={amount}
        onChangeText={(t) => {
          setAmount(t.replace(/[^\d.]/g, ""));
          setAmountError(null);
        }}
        error={amountError ?? undefined}
        keyboardType="numeric"
        helperText={
          invoice.whtAmount > 0
            ? `Balance after the withholding tax (${formatMoney(invoice.whtAmount)} is withheld by the customer).`
            : "Part payments are fine."
        }
      />
      <SelectField label="Paid by" required value={method} options={METHOD_OPTIONS} onChange={setMethod} />
      <TextField
        label="Reference / cheque number"
        value={reference}
        onChangeText={setReference}
        maxLength={100}
        autoCapitalize="characters"
        placeholder="e.g. TR-123456"
      />
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline rows={2} maxLength={1000} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stack: { alignItems: "flex-start", gap: spacing.xs },
  shrink: { flexShrink: 1 },
});
