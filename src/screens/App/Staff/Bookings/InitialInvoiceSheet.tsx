import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Banner, BottomSheet, Button, Card, Divider, ErrorState, InfoRow, ListSkeleton, SegmentedControl, SelectField } from "../../../../components/ui";
import { errorMessage } from "../../../../services/apiClient";
import {
  getWhtRates,
  initialChoiceFromPreview,
  previewInitialInvoice,
  sendInitialInvoice,
  type InitialInvoiceChoice,
  type InitialInvoicePreview,
  type WhtRate,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";

/**
 * "Send initial invoice" (CMS Preview Initial Payment Invoice): the server's own figures for the booking's first
 * invoice (1st billing cycle rent, security deposit; POST send-initial-invoice?preview=true, nothing saved), the
 * invoice type (Standard / Withholding tax with its rate), then Send: the invoice is created and emailed to the
 * customer with the bank payment procedure. A first invoice that already exists is only emailed again.
 * `issuedOn` (yyyy-MM-dd): after a signed agreement the invoice is dated on the agreement.
 */
export function InitialInvoiceSheet({
  bookingId,
  issuedOn,
  customerName,
  customerEmail,
  spaceName,
  onClose,
  onSent,
}: {
  bookingId: number;
  issuedOn?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  spaceName?: string | null;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [choice, setChoice] = useState<InitialInvoiceChoice>(undefined);
  const [preview, setPreview] = useState<InitialInvoicePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rates, setRates] = useState<WhtRate[] | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // A quicker answer for an older choice must not overwrite the newer one.
  const seq = useRef(0);

  const needsRate = choice?.type === "wht" && !(choice.whTaxId > 0);

  const load = useCallback(
    async (next: InitialInvoiceChoice) => {
      const mine = ++seq.current;
      setPreview(null);
      setLoadError(null);
      if (next?.type === "wht" && !(next.whTaxId > 0)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const p = await previewInitialInvoice(bookingId, { issuedOn, choice: next });
        if (mine !== seq.current) return;
        setPreview(p);
        // First answer: preselect the booking's own setting (its WHT rate, else Standard).
        if (next === undefined) setChoice(initialChoiceFromPreview(p));
      } catch (err) {
        if (mine === seq.current) setLoadError(errorMessage(err, "The invoice could not be calculated. Nothing has been sent."));
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [bookingId, issuedOn],
  );

  useEffect(() => {
    load(undefined);
  }, [load]);

  useEffect(() => {
    let alive = true;
    getWhtRates()
      .then((r) => alive && setRates(r))
      .catch(() => alive && setRates([]));
    return () => {
      alive = false;
    };
  }, []);

  const changeChoice = (next: Exclude<InitialInvoiceChoice, undefined>) => {
    setChoice(next);
    setSendError(null);
    load(next);
  };

  const send = async () => {
    if (!preview || needsRate || sending) return;
    setSending(true);
    setSendError(null);
    try {
      // An existing first invoice is only re-sent as it was posted: no type is sent with it.
      const result = await sendInitialInvoice(bookingId, { issuedOn, choice: preview.hasExistingInvoice ? undefined : choice });
      onSent(result.message);
    } catch (err) {
      setSendError(errorMessage(err, "Could not send the initial invoice."));
    } finally {
      setSending(false);
    }
  };

  const whtRateId = choice?.type === "wht" ? choice.whTaxId : null;

  return (
    <BottomSheet
      visible
      onClose={onClose}
      dismissible={!sending}
      title={preview?.hasExistingInvoice ? "Send the first invoice again" : "Send initial invoice"}
      subtitle={`Booking #${bookingId}${spaceName ? ` · ${spaceName}` : ""}`}
      error={sendError}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={sending} style={styles.flex} />
          <Button
            title={preview?.hasExistingInvoice ? "Send again" : "Send invoice"}
            leftIcon="paper-plane-outline"
            onPress={send}
            loading={sending}
            disabled={!preview || needsRate || loading}
            style={styles.flex}
            haptic
          />
        </>
      }
    >
      <Banner
        tone="info"
        message={`This emails the 1st billing cycle rent, the security deposit and the bank payment procedure to the customer.${
          issuedOn ? ` The invoice is dated ${formatDate(issuedOn)} (the signed agreement's date).` : ""
        }`}
      />
      {customerName || customerEmail ? (
        <Card variant="outlined">
          {customerName ? <InfoRow label="Customer" value={customerName} icon="person-outline" /> : null}
          {customerEmail ? <InfoRow label="Sent to" value={customerEmail} icon="mail-outline" /> : null}
        </Card>
      ) : null}

      {preview?.hasExistingInvoice ? (
        <Banner tone="warning" message="The first invoice of this booking already exists. It is emailed again exactly as it was issued." />
      ) : (
        <View style={styles.stack}>
          <SegmentedControl
            accessibilityLabel="Invoice type"
            options={[
              { label: "Standard", value: "standard" },
              { label: "Withholding tax", value: "wht" },
            ]}
            value={choice?.type ?? "standard"}
            onChange={(v) => {
              if (v === "standard") changeChoice({ type: "standard" });
              else changeChoice({ type: "wht", whTaxId: whtRateId ?? preview?.bookingWhTaxId ?? 0 });
            }}
          />
          {choice?.type === "wht" ? (
            <SelectField
              label="WHT rate"
              required
              value={whtRateId && whtRateId > 0 ? whtRateId : null}
              options={(rates ?? []).map((r) => ({ label: `${r.description} (${r.rate}%)`, value: r.id }))}
              onChange={(id) => changeChoice({ type: "wht", whTaxId: id })}
              loading={rates === null}
              placeholder="Choose the WHT rate"
              emptyText="No WHT rates are set up."
            />
          ) : null}
        </View>
      )}

      {needsRate ? (
        <Banner tone="warning" message="Choose the WHT rate to work out the withholding tax invoice." />
      ) : loading ? (
        <ListSkeleton rows={3} variant="rows" />
      ) : loadError ? (
        <ErrorState compact message={loadError} onRetry={() => load(choice)} />
      ) : preview ? (
        <Card>
          <InfoRow label={`1st cycle rent (${preview.billingMonths} month${preview.billingMonths === 1 ? "" : "s"})`} value={formatMoney(preview.rent)} />
          {preview.description ? (
            <AppText variant="caption" color="textMuted">
              {preview.description}
            </AppText>
          ) : null}
          {preview.discount > 0 ? (
            <InfoRow
              label={`Discount${preview.discountPercentage ? ` (${preview.discountPercentage}%)` : ""}`}
              value={`- ${formatMoney(preview.discount)}`}
              valueColor="success"
            />
          ) : null}
          <InfoRow label="Tax on the service charge" value={formatMoney(preview.tax)} />
          {preview.serviceCharge > 0 ? (
            <AppText variant="caption" color="textMuted">
              {`Service charge ${formatMoney(preview.serviceCharge)} is part of the rent.`}
            </AppText>
          ) : null}
          {preview.isWhtInvoice ? <InfoRow label={`WHT gross-up (${preview.whtRatePercent}%)`} value={formatMoney(preview.whtGrossUp)} /> : null}
          {preview.securityDeposit > 0 ? <InfoRow label="Security deposit (refundable)" value={formatMoney(preview.securityDeposit)} /> : null}
          <Divider spacing={8} />
          <InfoRow label="Total payable" value={formatMoney(preview.grandTotal)} emphasize />
          {preview.isWhtInvoice ? (
            <>
              <InfoRow label={`Less WHT (${preview.whtRatePercent}%), withheld by the customer`} value={`- ${formatMoney(preview.whtAmount)}`} />
              <InfoRow label="Net payable" value={formatMoney(preview.netPayableAfterWht)} emphasize />
            </>
          ) : null}
          {preview.dueOn ? <InfoRow label="Due" value={formatDate(preview.dueOn)} /> : null}
        </Card>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: spacing.sm },
});
