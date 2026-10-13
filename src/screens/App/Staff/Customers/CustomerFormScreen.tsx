import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  Button,
  Card,
  ErrorState,
  ListSkeleton,
  SegmentedControl,
  SelectField,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  createCustomer,
  customerToInput,
  getCities,
  getCustomer,
  keepExistingTaxIds,
  updateCustomer,
  validateCustomerInput,
  type City,
  type CustomerField,
  type CustomerInput,
  type CustomerType,
  type StaffCustomer,
} from "../../../../services/staff";
import { formatCnicInput } from "../../../../utils/cnic";
import { formatPhoneInput } from "../../../../utils/phone";
import { spacing } from "../../../../theme";
import { StaffScreen } from "../shared/StaffScreen";
import { useSingleFlight } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "CustomerForm">;

const EMPTY: CustomerInput = {
  customerType: "Individual",
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phoneNumber: "",
  cnicOrPassport: "",
  address: "",
  cityId: null,
  notes: "",
  ntn: "",
  secpRegistrationNo: "",
  isActive: true,
};

const TYPE_OPTIONS: { label: string; value: CustomerType }[] = [
  { label: "Individual", value: "Individual" },
  { label: "Company", value: "Company" },
  { label: "AOP", value: "AOP" },
];

/**
 * New / edit customer (POST customer, PUT customer/{id} with the whole customer). Same rules as the API and the
 * CMS form: first name and email required; CNIC 13 digits and phone 11-15 digits when given; Company / AOP need
 * the company name and an 8-digit NTN.
 */
export default function CustomerFormScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const editingId = params?.customerId;
  const shownCustomer = params?.customer;

  const [form, setForm] = useState<CustomerInput>(EMPTY);
  // The customer as loaded: its NTN / SECP number are kept when the form leaves them blank.
  const [original, setOriginal] = useState<StaffCustomer | null>(null);
  const [errors, setErrors] = useState<Partial<Record<CustomerField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editingId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  const lastNameRef = useRef<TextInput>(null);
  const companyRef = useRef<TextInput>(null);
  const ntnRef = useRef<TextInput>(null);
  const secpRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const cnicRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  const isCompany = form.customerType !== "Individual";

  const loadCustomer = useCallback(async () => {
    if (!editingId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const c = await getCustomer(editingId, { listRow: shownCustomer, taxIds: true });
      setOriginal(c);
      setForm(customerToInput(c));
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [editingId, shownCustomer]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setCitiesLoading(false));
  }, []);

  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const cityOptions = useMemo(() => cities.map((c) => ({ label: c.name, value: c.id })), [cities]);

  const save = useSingleFlight(async () => {
    const input = editingId ? keepExistingTaxIds(form, original) : form;
    const found = validateCustomerInput(input);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const result = await updateCustomer(editingId, input);
        toast.success(result.message);
        navigation.goBack();
      } else {
        const result = await createCustomer(form);
        toast.success(result.message);
        if (params?.returnTo && result.data.id > 0) {
          // Back to the form that opened this one (keeping what was entered there), with the new customer picked.
          navigation.popTo(params.returnTo, { customerId: result.data.id }, { merge: true });
        } else if (result.data.id > 0) {
          navigation.replace("CustomerDetail", { customerId: result.data.id });
        } else {
          navigation.goBack();
        }
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not save the customer. Please try again."));
    } finally {
      setSaving(false);
    }
  });

  return (
    <StaffScreen>
      <AppHeader title={editingId ? "Edit customer" : "New customer"} />
      {loading ? (
        <ListSkeleton rows={4} variant="rows" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadCustomer} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Card>
              <View style={styles.form}>
                <SegmentedControl
                  accessibilityLabel="Customer type"
                  options={TYPE_OPTIONS}
                  value={form.customerType}
                  onChange={(v) => set("customerType", v)}
                />
                <TextField
                  label="First name"
                  required
                  value={form.firstName}
                  onChangeText={(t) => set("firstName", t)}
                  error={errors.firstName}
                  autoCapitalize="words"
                  maxLength={60}
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
                <TextField
                  ref={lastNameRef}
                  label="Last name"
                  value={form.lastName}
                  onChangeText={(t) => set("lastName", t)}
                  autoCapitalize="words"
                  maxLength={60}
                  returnKeyType="next"
                  onSubmitEditing={() => (isCompany ? companyRef : emailRef).current?.focus()}
                />
                {isCompany ? (
                  <>
                    <TextField
                      ref={companyRef}
                      label="Company / business name"
                      required
                      value={form.company}
                      onChangeText={(t) => set("company", t)}
                      error={errors.company}
                      autoCapitalize="words"
                      maxLength={80}
                      returnKeyType="next"
                      onSubmitEditing={() => ntnRef.current?.focus()}
                    />
                    <TextField
                      ref={ntnRef}
                      label="NTN"
                      required
                      value={form.ntn}
                      onChangeText={(t) => set("ntn", t.replace(/[^\d-]/g, "").slice(0, 9))}
                      error={errors.ntn}
                      keyboardType="number-pad"
                      placeholder="1234567-8"
                      helperText="8 digits"
                      returnKeyType="next"
                      onSubmitEditing={() => secpRef.current?.focus()}
                    />
                    <TextField
                      ref={secpRef}
                      label="SECP registration no."
                      value={form.secpRegistrationNo}
                      onChangeText={(t) => set("secpRegistrationNo", t)}
                      maxLength={40}
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  </>
                ) : null}
                <TextField
                  ref={emailRef}
                  label="Email"
                  required
                  value={form.email}
                  onChangeText={(t) => set("email", t.trim())}
                  error={errors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  leftIcon="mail-outline"
                  maxLength={120}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
                <TextField
                  ref={phoneRef}
                  label="Phone"
                  value={form.phoneNumber}
                  onChangeText={(t) => set("phoneNumber", formatPhoneInput(t))}
                  error={errors.phoneNumber}
                  keyboardType="phone-pad"
                  leftIcon="call-outline"
                  placeholder="03001234567"
                  helperText="11 to 15 digits"
                  returnKeyType="next"
                  onSubmitEditing={() => cnicRef.current?.focus()}
                />
                <TextField
                  ref={cnicRef}
                  label="CNIC"
                  value={form.cnicOrPassport}
                  onChangeText={(t) => set("cnicOrPassport", formatCnicInput(t))}
                  error={errors.cnicOrPassport}
                  keyboardType="number-pad"
                  placeholder="35202-1234567-1"
                  helperText="13 digits"
                  returnKeyType="next"
                  onSubmitEditing={() => addressRef.current?.focus()}
                />
                <TextField
                  ref={addressRef}
                  label="Address"
                  value={form.address}
                  onChangeText={(t) => set("address", t)}
                  multiline
                  rows={2}
                  maxLength={200}
                />
                <SelectField
                  label="City"
                  value={form.cityId ?? null}
                  options={cityOptions}
                  onChange={(v) => set("cityId", v)}
                  loading={citiesLoading}
                  placeholder="Choose a city"
                  leftIcon="business-outline"
                  emptyText="Cities could not be loaded"
                />
                <TextField
                  ref={notesRef}
                  label="Notes"
                  value={form.notes}
                  onChangeText={(t) => set("notes", t)}
                  multiline
                  rows={3}
                  maxLength={500}
                />
              </View>
            </Card>
            <Button
              title={editingId ? "Save changes" : "Create customer"}
              onPress={save}
              loading={saving}
              disabled={saving}
              leftIcon="checkmark"
              fullWidth
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.lg },
});
