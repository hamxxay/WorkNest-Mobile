import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  Divider,
  ErrorState,
  InfoRow,
  ListSkeleton,
  SectionHeader,
  StatusPill,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import { downloadInvoicePdf, emailInvoice, getInvoice } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatDateRange, formatMoney, formatNumber } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";
import { useAsyncData } from "../shared/hooks";
import { useOpenFile } from "../shared/useOpenFile";
import { useRefreshColors } from "../shared/refresh";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "InvoiceDetail">;

/** One invoice (GET invoice/{id}) with its lines: statement PDF (login token) and email to the customer. */
export default function InvoiceDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const refreshColors = useRefreshColors();
  const { opening, open } = useOpenFile();
  const [emailing, setEmailing] = useState(false);
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
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="heading" numberOfLines={2}>
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
                    <View style={styles.row}>
                      <AppText variant="caption" color="textMuted" style={styles.flex}>
                        {formatNumber(l.quantity)} x {formatMoney(l.unitPrice)}
                        {l.taxRate ? ` · tax ${formatNumber(l.taxRate * (l.taxRate <= 1 ? 100 : 1))}%` : ""}
                      </AppText>
                      <AppText variant="bodySmall">{formatMoney(l.quantity * l.unitPrice - l.discountAmount)}</AppText>
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

          <View style={styles.row}>
            <Button
              title="Statement PDF"
              variant="outline"
              leftIcon="document-outline"
              loading={opening === "pdf"}
              onPress={() => open("pdf", () => downloadInvoicePdf(inv.id, inv.invoiceNumber), inv.invoiceNumber)}
              style={styles.flex}
            />
            <Button title="Email customer" leftIcon="mail-outline" loading={emailing} onPress={sendEmail} style={styles.flex} />
          </View>
          <AppText variant="caption" color="textMuted" align="center">
            Payments are recorded as fee receipts in the web portal.
          </AppText>
        </ScrollView>
      ) : null}
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
