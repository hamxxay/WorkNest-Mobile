import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Banner,
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
  agreementAmount,
  agreementFeePerCycle,
  agreementFormProblems,
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
type Errors = Partial<Record<"fullName" | "cnic" | "phone" | "address" | "companyName" | "start" | "end" | "fee" | "deposit" | "email", string>>;

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
  // The customer's saved NTN / SECP number: the API copies the agreement's values onto the customer, so blank
  // fields send these instead of clearing them.
  const [savedTaxIds, setSavedTaxIds] = useState<{ ntn: string | null; secpRegistrationNo: string | null } | null>(null);
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
  // The API's own reason when it refuses the agreement (kept on screen; a toast is easy to miss).
  const [sendError, setSendError] = useState<string | null>(null);

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
      // 0 is a valid deposit (the API needs a number; blank used to send null and fail).
      setDeposit(String(q.securityDeposit || 0));
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
        // getCustomer also finds the NTN / SECP number when GET customer/{id} doesn't carry them.
        const c = await getCustomer(q.customerId, { taxIds: true });
        setSavedTaxIds({ ntn: c.ntn, secpRegistrationNo: c.secpRegistrationNo });
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
    setSendError(null);
    const company = entity !== "Individual";
    const ntnValue = company ? ntn.trim() || savedTaxIds?.ntn || "" : "";
    const secpValue = company ? secp.trim() || savedTaxIds?.secpRegistrationNo || "" : "";
    // What the API needs (name, ID, address, dates, fee above 0, deposit 0 or more), then the format rules.
    const next: Errors = agreementFormProblems({
      entityType: entity,
      fullName,
      cnic,
      ntn: ntnValue,
      secpRegistrationNo: secpValue,
      address,
      companyName,
      contractStartDate: start ? toApiDate(start) : null,
      contractEndDate: end ? toApiDate(end) : null,
      fee,
      deposit,
    });
    const cErr = cnicError(cnic);
    if (cErr) next.cnic = cErr;
    const pErr = phoneError(phone);
    if (pErr) next.phone = pErr;
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
      companyName: company ? companyName : undefined,
      ntn: ntnValue || undefined,
      secpRegistrationNo: secpValue || undefined,
      refundDays: Number(refundDays) || 30,
      feeAmount: agreementAmount(fee),
      securityDeposit: agreementAmount(deposit),
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
      const message = errorMessage(err, "Could not send the agreement.");
      setSendError(message);
      toast.error(message);
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
                  required={entity === "Individual"}
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
                <TextField ref={addressRef} label="Address" required value={address} onChangeText={setAddress} error={errors.address} multiline rows={2} maxLength={200} />
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
                  <DateField label="Contract start" required value={start} onChange={setStart} containerStyle={styles.flex} error={errors.start} />
                  <DateField label="Contract end" required value={end} onChange={setEnd} containerStyle={styles.flex} error={errors.end} minimumDate={start ?? undefined} />
                </View>
                <SelectField label="Billing" value={billingMonths} options={BILLING} onChange={(v) => {
                  setBillingMonths(v);
                  if (quotation) setFee(String(agreementFeePerCycle(quotation, v) || ""));
                }} />
                <TextField
                  label="Fee per billing cycle (PKR)"
                  required
                  value={fee}
                  onChangeText={(t) => setFee(t.replace(/[^\d.]/g, ""))}
                  error={errors.fee}
                  keyboardType="numeric"
                  helperText={quotation ? `From the quotation's monthly rent ${formatMoney(quotation.monthlyRent || quotation.monthlyBasePrice)}` : undefined}
                />
                <TextField
                  label="Security deposit (PKR)"
                  required
                  value={deposit}
                  onChangeText={(t) => setDeposit(t.replace(/[^\d.]/g, ""))}
                  error={errors.deposit}
                  keyboardType="numeric"
                  helperText="0 if there is no deposit."
                />
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
            {sendError ? <Banner tone="danger" title="The agreement was not sent" message={sendError} onDismiss={() => setSendError(null)} /> : null}
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
