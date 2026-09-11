import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../../components/Header";
import { Screen } from "../../../components/Screen";
import { useThemeColors, useThemedStyles } from "../../../theme";
import { createAdminBooking, normalizeBookingPayload } from "../../../services/bookingService";

const EMPTY_FORM = {
  userIdGuid: "",
  userId: "",
  spaceIdGuid: "",
  spaceId: "",
  startDateTime: "",
  endDateTime: "",
  startDate: "",
  endDate: "",
  startOn: "",
  endOn: "",
  contractStartDate: "",
  contractEndDate: "",
  billingStartDate: "",
  effectiveFrom: "",
  notes: "",
  customerEmail: "",
  customerName: "",
  phone: "",
  discountType: "",
  discountPercentage: "",
  discountValue: "",
  securityDepositOverride: "",
  floorId: "",
  billingPeriodMonths: "",
  securityDepositMonths: "",
  advanceRentMonths: "",
  supportChargesId: "",
  capacity: "",
};

export default function SaleBookingCreateScreen({ navigation }: { navigation: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    return [form.spaceId, form.startDateTime, form.endDateTime, form.customerName, form.customerEmail, form.phone].every(Boolean);
  }, [form]);

  const updateField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert("Missing fields", "Please complete the required booking information.");
      return;
    }

    try {
      setSaving(true);
      const payload = normalizeBookingPayload({
        ...form,
        discountPercentage: form.discountPercentage || "0",
        discountValue: form.discountValue || "0",
        securityDepositOverride: form.securityDepositOverride || "0",
        floorId: form.floorId || "0",
        billingPeriodMonths: form.billingPeriodMonths || "0",
        securityDepositMonths: form.securityDepositMonths || "0",
        advanceRentMonths: form.advanceRentMonths || "0",
        supportChargesId: form.supportChargesId || "0",
        capacity: form.capacity || "0",
      });
      await createAdminBooking(payload);
      Alert.alert("Booking created", "The booking was saved successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create booking.";
      Alert.alert("Create booking failed", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <View style={styles.iconBox}>
              <Ionicons name="calendar-outline" size={24} color={colors.white} />
            </View>
            <View>
              <Text style={styles.eyebrow}>BOOKING</Text>
              <Text style={styles.title}>Create Booking</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>Customer</Text>
            <Field label="User Guid" value={form.userIdGuid} onChangeText={(value) => updateField("userIdGuid", value)} />
            <Field label="User Id" value={form.userId} onChangeText={(value) => updateField("userId", value)} keyboardType="numeric" />
            <Field label="Customer Name" value={form.customerName} onChangeText={(value) => updateField("customerName", value)} />
            <Field label="Customer Email" value={form.customerEmail} onChangeText={(value) => updateField("customerEmail", value)} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Phone" value={form.phone} onChangeText={(value) => updateField("phone", value)} keyboardType="phone-pad" />

            <Text style={styles.sectionLabel}>Space & schedule</Text>
            <Field label="Space Guid" value={form.spaceIdGuid} onChangeText={(value) => updateField("spaceIdGuid", value)} />
            <Field label="Space Id" value={form.spaceId} onChangeText={(value) => updateField("spaceId", value)} keyboardType="numeric" />
            <Field label="Start Date Time" value={form.startDateTime} onChangeText={(value) => updateField("startDateTime", value)} placeholder="2026-09-11T11:21:44.046Z" />
            <Field label="End Date Time" value={form.endDateTime} onChangeText={(value) => updateField("endDateTime", value)} placeholder="2026-09-11T11:21:44.046Z" />
            <Field label="Start Date" value={form.startDate} onChangeText={(value) => updateField("startDate", value)} />
            <Field label="End Date" value={form.endDate} onChangeText={(value) => updateField("endDate", value)} />
            <Field label="Start On" value={form.startOn} onChangeText={(value) => updateField("startOn", value)} />
            <Field label="End On" value={form.endOn} onChangeText={(value) => updateField("endOn", value)} />
            <Field label="Contract Start Date" value={form.contractStartDate} onChangeText={(value) => updateField("contractStartDate", value)} />
            <Field label="Contract End Date" value={form.contractEndDate} onChangeText={(value) => updateField("contractEndDate", value)} />
            <Field label="Billing Start Date" value={form.billingStartDate} onChangeText={(value) => updateField("billingStartDate", value)} />
            <Field label="Effective From" value={form.effectiveFrom} onChangeText={(value) => updateField("effectiveFrom", value)} />

            <Text style={styles.sectionLabel}>Finance</Text>
            <Field label="Discount Type" value={form.discountType} onChangeText={(value) => updateField("discountType", value)} />
            <Field label="Discount Percentage" value={form.discountPercentage} onChangeText={(value) => updateField("discountPercentage", value)} keyboardType="numeric" />
            <Field label="Discount Value" value={form.discountValue} onChangeText={(value) => updateField("discountValue", value)} keyboardType="numeric" />
            <Field label="Security Deposit Override" value={form.securityDepositOverride} onChangeText={(value) => updateField("securityDepositOverride", value)} keyboardType="numeric" />
            <Field label="Floor Id" value={form.floorId} onChangeText={(value) => updateField("floorId", value)} keyboardType="numeric" />
            <Field label="Billing Period Months" value={form.billingPeriodMonths} onChangeText={(value) => updateField("billingPeriodMonths", value)} keyboardType="numeric" />
            <Field label="Security Deposit Months" value={form.securityDepositMonths} onChangeText={(value) => updateField("securityDepositMonths", value)} keyboardType="numeric" />
            <Field label="Advance Rent Months" value={form.advanceRentMonths} onChangeText={(value) => updateField("advanceRentMonths", value)} keyboardType="numeric" />
            <Field label="Support Charges Id" value={form.supportChargesId} onChangeText={(value) => updateField("supportChargesId", value)} keyboardType="numeric" />
            <Field label="Capacity" value={form.capacity} onChangeText={(value) => updateField("capacity", value)} keyboardType="numeric" />
            <Field label="Notes" value={form.notes} onChangeText={(value) => updateField("notes", value)} multiline />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || !canSubmit}
            activeOpacity={0.9}
          >
            <Text style={styles.submitText}>{saving ? "Saving..." : "Create Booking"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words";
  multiline?: boolean;
  placeholder?: string;
}) {
  const colors = useThemeColors();
  const fieldStyles = useThemedStyles(createStyles);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "700", marginBottom: 8 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[
          fieldStyles.input,
          multiline && fieldStyles.textarea,
          { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
        ]}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { paddingHorizontal: 18, paddingBottom: 32, gap: 16 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
    iconBox: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 1,
      color: colors.primary,
      fontWeight: "800",
    },
    title: {
      fontSize: 24,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    formCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: 12,
      marginTop: 8,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      minHeight: 46,
    },
    textarea: {
      minHeight: 92,
      textAlignVertical: "top",
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginHorizontal: 18,
      marginBottom: 30,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitText: {
      color: colors.white,
      fontWeight: "800",
      fontSize: 14,
    },
  });
