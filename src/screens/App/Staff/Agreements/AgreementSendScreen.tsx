import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  DateField,
  ErrorState,
  ListSkeleton,
  SectionHeader,
  SegmentedControl,
  SelectField,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  agreementFeePerCycle,
  getCustomer,
  getQuotation,
  sendAgreement,
  toApiDate,
  validateSendAgreement,
  type SendAgreementInput,
  type StaffQuotation,
} from "../../../../services/staff";
import { cnicError, formatCnicInput } from "../../../../utils/cnic";
import { formatPhoneInput, phoneError } from "../../../../utils/phone";
import { formatMoney, parseDate } from "../../../../utils/format";
import { spacing } from "../../../../theme";
import { StaffScreen } from "../shared/StaffScreen";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "AgreementSend">;
type Entity = SendAgreementInput["entityType"];
type Errors = Partial<Record<"fullName" | "cnic" | "phone" | "companyName" | "start" | "end" | "fee" | "email", string>>;

const BILLING = [
  { label: "Monthly", value: 1 },
  { label: "Bi-Monthly", value: 2 },
  { label: "Quarterly", value: 3 },
  { label: "Bi-Annual", value: 6 },
  { label: "Annual", value: 12 },
];

/**
 * Send the lease agreement for an accepted quotation (POST agreement/send): prefilled from the quotation and the
 * customer like the CMS dialog; the API generates the PDF and emails it.
 */
export default function AgreementSendScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quotation, setQuotation] = useState<StaffQuotation | null>(null);

  const [entity, setEntity] = useState<Entity>("Individual");
  const [fullName, setFullName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ntn, setNtn] = useState("");
  const [secp, setSecp] = useState("");
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [billingMonths, setBillingMonths] = useState(1);
  const [fee, setFee] = useState("");
  const [deposit, setDeposit] = useState("");
  const [refundDays, setRefundDays] = useState("30");
  const [hours, setHours] = useState("24/7");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  const cnicRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const q = await getQuotation(params.quotationId);
      setQuotation(q);
      const bpm = [1, 2, 3, 6, 12].includes(q.billingPeriodMonths) ? q.billingPeriodMonths : 1;
      setBillingMonths(bpm);
      setFee(String(agreementFeePerCycle(q, bpm) || ""));
      setDeposit(q.securityDeposit ? String(q.securityDeposit) : "");
      setHours(q.offeringType || "24/7");
      setStart(parseDate(q.startDateTime));
      setEnd(parseDate(q.endDateTime));
      setFullName(q.customerName);
      setEmail(q.customerEmail ?? "");
      setAddress(q.customerAddress ?? "");
      if (q.customerCompany) {
        setEntity("Company");
        setCompanyName(q.customerCompany);
      }
      try {
        const c = await getCustomer(q.customerId);
        setFullName((prev) => prev || c.fullName);
        setCnic(c.cnicOrPassport ? formatCnicInput(c.cnicOrPassport) : "");
        setPhone(c.phoneNumber ?? "");
        setAddress((prev) => prev || c.address || "");
        setEmail((prev) => prev || c.email);
        if (c.customerType !== "Individual") {
          setEntity(c.customerType);
          setCompanyName((prev) => prev || c.company || "");
          setNtn(c.ntn ?? "");
          setSecp(c.secpRegistrationNo ?? "");
        }
      } catch {
        // The quotation already has the name / email; the customer's extra details are a convenience.
      }
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load the quotation."));
    } finally {
      setLoading(false);
    }
  }, [params.quotationId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = "Enter the customer's full name.";
    const cErr = cnicError(cnic);
    if (cErr) next.cnic = cErr;
    const pErr = phoneError(phone);
    if (pErr) next.phone = pErr;
    if (entity !== "Individual" && !companyName.trim()) next.companyName = "Enter the company name.";
    if (start && end && end <= start) next.end = "The end date must be after the start date.";
    const feeValue = Number(fee);
    if (fee.trim() && (!Number.isFinite(feeValue) || feeValue < 0)) next.fee = "Enter a valid amount.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const input: SendAgreementInput = {
      quotationId: params.quotationId,
      entityType: entity,
      fullName,
      cnic,
      phoneNumber: phone,
      address,
      companyName: entity === "Individual" ? undefined : companyName,
      ntn: entity === "Individual" ? undefined : ntn,
      secpRegistrationNo: entity === "Individual" ? undefined : secp,
      refundDays: Number(refundDays) || 30,
      feeAmount: fee.trim() ? feeValue : undefined,
      securityDeposit: deposit.trim() ? Number(deposit) || 0 : undefined,
      contractStartDate: start ? toApiDate(start) : null,
      contractEndDate: end ? toApiDate(end) : null,
      operatingHours: hours.trim() || "24/7",
      billingFrequency: BILLING.find((b) => b.value === billingMonths)?.label,
      overrideEmail: email,
    };
    const invalid = validateSendAgreement(input);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setSending(true);
    try {
      const result = await sendAgreement(input);
      toast.success(result.message);
      navigation.goBack();
    } catch (err) {
      toast.error(errorMessage(err, "Could not send the agreement."));
    } finally {
      setSending(false);
    }
  };

  return (
    <StaffScreen>
      <AppHeader title="Send agreement" subtitle={quotation?.quotationNumber} />
      {loading ? (
        <ListSkeleton rows={4} variant="rows" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <SectionHeader title="Customer" variant="overline" />
            <Card>
              <View style={styles.form}>
                <SegmentedControl
                  accessibilityLabel="Entity type"
                  options={[
                    { label: "Individual", value: "Individual" },
                    { label: "Company", value: "Company" },
                    { label: "AOP", value: "AOP" },
                  ]}
                  value={entity}
                  onChange={(v) => setEntity(v as Entity)}
                />
                <TextField
                  label="Full name"
                  required
                  value={fullName}
                  onChangeText={setFullName}
                  error={errors.fullName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => cnicRef.current?.focus()}
                />
                <TextField
                  ref={cnicRef}
                  label="CNIC"
                  value={cnic}
                  onChangeText={(t) => setCnic(formatCnicInput(t))}
                  error={errors.cnic}
                  keyboardType="number-pad"
                  placeholder="35202-1234567-1"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
                <TextField
                  ref={phoneRef}
                  label="Phone"
                  value={phone}
                  onChangeText={(t) => setPhone(formatPhoneInput(t))}
                  error={errors.phone}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => addressRef.current?.focus()}
                />
                <TextField ref={addressRef} label="Address" value={address} onChangeText={setAddress} multiline rows={2} maxLength={200} />
                {entity !== "Individual" ? (
                  <>
                    <TextField label="Company name" required value={companyName} onChangeText={setCompanyName} error={errors.companyName} />
                    <TextField label="NTN" value={ntn} onChangeText={(t) => setNtn(t.replace(/[^\d-]/g, "").slice(0, 9))} keyboardType="number-pad" />
                    <TextField label="SECP registration no." value={secp} onChangeText={setSecp} />
                  </>
                ) : null}
              </View>
            </Card>

            <SectionHeader title="Terms" variant="overline" />
            <Card>
              <View style={styles.form}>
                <View style={styles.row}>
                  <DateField label="Contract start" value={start} onChange={setStart} containerStyle={styles.flex} error={errors.start} />
                  <DateField label="Contract end" value={end} onChange={setEnd} containerStyle={styles.flex} error={errors.end} minimumDate={start ?? undefined} />
                </View>
                <SelectField label="Billing" value={billingMonths} options={BILLING} onChange={(v) => {
                  setBillingMonths(v);
                  if (quotation) setFee(String(agreementFeePerCycle(quotation, v) || ""));
                }} />
                <TextField
                  label="Fee per billing cycle (PKR)"
                  value={fee}
                  onChangeText={(t) => setFee(t.replace(/[^\d.]/g, ""))}
                  error={errors.fee}
                  keyboardType="numeric"
                  helperText={quotation ? `From the quotation's monthly rent ${formatMoney(quotation.monthlyRent || quotation.monthlyBasePrice)}` : undefined}
                />
                <TextField label="Security deposit (PKR)" value={deposit} onChangeText={(t) => setDeposit(t.replace(/[^\d.]/g, ""))} keyboardType="numeric" />
                <TextField label="Refund within (days)" value={refundDays} onChangeText={(t) => setRefundDays(t.replace(/\D/g, "").slice(0, 3))} keyboardType="number-pad" />
                <TextField label="Operating hours" value={hours} onChangeText={setHours} maxLength={40} />
              </View>
            </Card>

            <SectionHeader title="Delivery" variant="overline" />
            <Card>
              <TextField
                label="Send to"
                value={email}
                onChangeText={(t) => setEmail(t.trim())}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon="mail-outline"
                helperText="The customer's email unless you change it."
              />
            </Card>
            <AppText variant="caption" color="textMuted" align="center">
              WorkNest builds the lease PDF from these details and emails it with a link to sign.
            </AppText>
            <Button title="Send agreement" leftIcon="paper-plane-outline" onPress={submit} loading={sending} disabled={sending} fullWidth haptic />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  form: { gap: spacing.lg },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
});
