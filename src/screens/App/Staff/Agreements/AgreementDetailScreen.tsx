import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  BottomSheet,
  Button,
  Card,
  DateField,
  Divider,
  ErrorState,
  InfoRow,
  ListSkeleton,
  SectionHeader,
  StatusPill,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  downloadAgreementPdf,
  downloadSignedAgreementPdf,
  getAgreementESignature,
  signAgreement,
  toApiDate,
  type AgreementESignature,
  type StaffAgreement,
} from "../../../../services/staff";
import { spacing, statusTone, useThemeColors } from "../../../../theme";
import { formatDate, formatDateTime, formatMoney, parseDate } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";
import { useOpenFile } from "../shared/useOpenFile";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "AgreementDetail">;

/**
 * One lease agreement (from the list; the API has no single-agreement GET): terms and customer, the agreement
 * PDF and the signed copy (with the login token), the e-signature evidence, and "confirm signed" (POST
 * agreement/{id}/sign with the signed date) which creates the booking once the signed copy is on file.
 */
export default function AgreementDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const { opening, open } = useOpenFile();
  const [agreement, setAgreement] = useState<StaffAgreement>(params.agreement);
  const [signOpen, setSignOpen] = useState(false);
  const [esignOpen, setEsignOpen] = useState(false);
  const a = agreement;
  const canConfirm = !a.bookingId && a.hasSignedPdf;

  return (
    <StaffScreen>
      <AppHeader title="Agreement" subtitle={a.quotationNumber ?? undefined} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="heading" numberOfLines={2}>
                {a.customerName || "Customer"}
              </AppText>
              <AppText variant="bodySmall" color="textMuted">
                {a.entityType ?? "Individual"}
              </AppText>
            </View>
          </View>
          <View style={styles.gapTop}>
            <StatusPill tone={a.bookingId ? "success" : statusTone(a.status)} label={a.statusLabel} size="md" />
          </View>
          <Divider spacing={10} />
          {a.companyName ? <InfoRow label="Company" value={a.companyName} icon="business-outline" /> : null}
          {a.ntn ? <InfoRow label="NTN" value={a.ntn} /> : null}
          {a.customerCnic ? <InfoRow label="CNIC" value={a.customerCnic} icon="card-outline" /> : null}
          {a.customerPhone ? <InfoRow label="Phone" value={a.customerPhone} icon="call-outline" /> : null}
          {a.customerAddress ? <InfoRow label="Address" value={a.customerAddress} layout="stacked" icon="home-outline" /> : null}
        </Card>

        <SectionHeader title="Terms" variant="overline" />
        <Card>
          {a.feeAmount ? <InfoRow label="Fee per billing cycle" value={formatMoney(a.feeAmount)} /> : null}
          {a.securityDeposit ? <InfoRow label="Security deposit" value={formatMoney(a.securityDeposit)} /> : null}
          {a.refundDays != null ? <InfoRow label="Refund within" value={`${a.refundDays} days`} /> : null}
          {a.operatingHours ? <InfoRow label="Operating hours" value={a.operatingHours} /> : null}
          {a.templateName ? <InfoRow label="Template" value={a.templateName} /> : null}
          <InfoRow label="Sent" value={formatDate(a.sentDate)} icon="paper-plane-outline" />
          {a.signedDate ? <InfoRow label="Signed" value={formatDate(a.signedDate)} icon="create-outline" /> : null}
          {a.signedPdfUploadedAt ? <InfoRow label="Signed copy received" value={formatDateTime(a.signedPdfUploadedAt)} /> : null}
          {a.eSignedAt ? <InfoRow label="E-signed" value={`${a.eSignedBy ?? "Customer"}, ${formatDateTime(a.eSignedAt)}`} layout="stacked" /> : null}
          {a.reminderCount ? <InfoRow label="Reminders sent" value={String(a.reminderCount)} /> : null}
        </Card>

        <View style={styles.actions}>
          {a.bookingId ? (
            <Button
              title={`Open booking #${a.bookingId}`}
              leftIcon="calendar-outline"
              onPress={() => navigation.navigate("BookingDetail", { bookingId: a.bookingId as number })}
              fullWidth
            />
          ) : null}
          {canConfirm ? (
            <Button title="Confirm signed and create booking" leftIcon="checkmark-done-outline" onPress={() => setSignOpen(true)} fullWidth />
          ) : null}
          <View style={styles.row}>
            <Button
              title="Agreement PDF"
              variant="outline"
              leftIcon="document-outline"
              loading={opening === "pdf"}
              onPress={() => open("pdf", () => downloadAgreementPdf(a.id), "Lease agreement")}
              style={styles.flex}
            />
            {a.hasSignedPdf ? (
              <Button
                title="Signed copy"
                variant="outline"
                leftIcon="document-text-outline"
                loading={opening === "signed"}
                onPress={() => open("signed", () => downloadSignedAgreementPdf(a.id), "Signed agreement")}
                style={styles.flex}
              />
            ) : null}
          </View>
          {a.eSignedAt ? (
            <Button title="E-signature details" variant="ghost" leftIcon="finger-print-outline" onPress={() => setEsignOpen(true)} fullWidth />
          ) : null}
          {a.quotationId && !a.bookingId ? (
            <Button
              title={a.status === "EmailFailed" ? "Send again" : "Send a new agreement"}
              variant="secondary"
              leftIcon="paper-plane-outline"
              onPress={() => navigation.navigate("AgreementSend", { quotationId: a.quotationId as number })}
              fullWidth
            />
          ) : null}
          {!a.bookingId && !a.hasSignedPdf ? (
            <Card variant="filled">
              <AppText variant="bodySmall" color="textSecondary">
                Waiting for the signed copy. The customer can e-sign or upload it in the WorkNest app. To upload a scanned PDF
                yourself, use the web portal.
              </AppText>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {signOpen ? (
        <ConfirmSignedSheet
          agreement={a}
          onClose={() => setSignOpen(false)}
          onDone={(message, updated) => {
            setSignOpen(false);
            setAgreement(updated.id ? updated : { ...a, bookingId: updated.bookingId });
            toast.success(message);
          }}
        />
      ) : null}
      {esignOpen ? <ESignatureSheet agreementId={a.id} onClose={() => setEsignOpen(false)} /> : null}
    </StaffScreen>
  );
}

function ConfirmSignedSheet({
  agreement,
  onClose,
  onDone,
}: {
  agreement: StaffAgreement;
  onClose: () => void;
  onDone: (message: string, updated: StaffAgreement) => void;
}) {
  const sent = parseDate(agreement.sentDate);
  const [signedDate, setSignedDate] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!signedDate) return setError("Enter the date written on the signed agreement.");
    setSaving(true);
    setError(null);
    try {
      const result = await signAgreement(agreement.id, { signedDate: toApiDate(signedDate), note });
      onDone(result.message, result.data);
    } catch (err) {
      setError(errorMessage(err, "Could not confirm the agreement."));
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
      title="Confirm signed agreement"
      subtitle="Uses the signed copy on file. WorkNest creates the booking dated on the signed date."
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Confirm" onPress={submit} loading={saving} style={styles.flex} />
        </>
      }
    >
      <DateField
        label="Signed on"
        required
        value={signedDate}
        onChange={(d) => {
          setSignedDate(d);
          setError(null);
        }}
        maximumDate={new Date()}
        minimumDate={sent ?? undefined}
        helperText="The date written on the signed agreement."
      />
      <TextField label="Note" value={note} onChangeText={setNote} multiline rows={2} maxLength={500} />
    </BottomSheet>
  );
}

function ESignatureSheet({ agreementId, onClose }: { agreementId: number; onClose: () => void }) {
  const colors = useThemeColors();
  const [data, setData] = useState<AgreementESignature | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    getAgreementESignature(agreementId)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(errorMessage(err)));
    return () => {
      alive = false;
    };
  }, [agreementId, attempt]);
  return (
    <BottomSheet visible onClose={onClose} title="E-signature">
      {error ? (
        <ErrorState compact message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : data === undefined ? (
        <ListSkeleton rows={2} variant="rows" />
      ) : !data ? (
        <AppText color="textMuted">This agreement was not signed electronically.</AppText>
      ) : (
        <>
          <InfoRow label="Signed by" value={data.signerName ?? "—"} />
          {data.signerEmail ? <InfoRow label="Email" value={data.signerEmail} /> : null}
          <InfoRow label="Signed at" value={formatDateTime(data.signedAt)} />
          {data.ipAddress ? <InfoRow label="IP address" value={data.ipAddress} /> : null}
          {data.signatureImage ? (
            <Card variant="outlined">
              {/* Dark ink on a transparent image: always shown on paper so it stays readable in dark mode. */}
              <Image
                source={{ uri: data.signatureImage }}
                style={[styles.signature, { backgroundColor: colors.paper, borderColor: colors.paperBorder }]}
                resizeMode="contain"
                accessibilityLabel="Customer signature"
              />
            </Card>
          ) : null}
          {data.documentSha256 ? (
            <AppText variant="caption" color="textMuted" selectable>
              Document fingerprint: {data.documentSha256}
            </AppText>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  gapTop: { marginTop: spacing.sm, alignSelf: "flex-start" },
  actions: { gap: spacing.sm },
  signature: { width: "100%", height: 120, borderRadius: 8, borderWidth: 1 },
});
