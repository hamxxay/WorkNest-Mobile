import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import type { AppStackParamList } from "../../navigation/types";
import { createBooking } from "../../services/workspaceService";
import { createLocalPaymentVoucher, type PaymentItem } from "../../services/paymentService";
import {
  INPUT_LIMITS,
  sanitizeAccountNumberInput,
  sanitizeCardCvvInput,
  sanitizeCardExpiryInput,
  sanitizeCardHolderName,
  sanitizeCardNumberInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  sanitizeTextForState,
  sanitizeTransferReferenceInput,
} from "../../utils/inputSanitizer";

type PaymentMethod =
  | "quick-pay"
  | "credit-debit-card"
  | "easypaisa"
  | "cash-counter"
  | "bank-transfer";

const PAYMENT_METHODS: { key: PaymentMethod; label: string; helper: string }[] = [
  { key: "quick-pay", label: "Quick Pay", helper: "Instant wallet or card checkout" },
  { key: "credit-debit-card", label: "Credit / Debit Card", helper: "Pay securely using your bank card" },
  { key: "easypaisa", label: "Easypaisa", helper: "Pay with your Easypaisa mobile wallet" },
  { key: "cash-counter", label: "Cash on Counter", helper: "Pay in cash at the reception counter" },
  { key: "bank-transfer", label: "Bank Transfer", helper: "Transfer to the WorkNest bank account" },
];

export default function PaymentScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const route = useRoute<RouteProp<AppStackParamList, "Payment">>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { workspace, booking } = route.params;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("quick-pay");
  const [detailsModalMethod, setDetailsModalMethod] = useState<PaymentMethod | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voucher, setVoucher] = useState<PaymentItem | null>(null);

  const bookingAmount = useMemo(() => {
    if (booking.mode === "office") {
      return workspace.price * 30;
    }

    const bookedDays = Math.max(booking.dates.length, 1);
    return workspace.price * bookedDays;
  }, [booking.dates.length, booking.mode, workspace.price]);

  const bookingSummary = useMemo(() => {
    if (booking.mode === "office") {
      return `${booking.month ?? "Monthly booking"} - Private office`;
    }

    return `${booking.dates.join(", ")} - ${booking.slot}`;
  }, [booking.dates, booking.mode, booking.month, booking.slot]);

  const selectedMethodLabel = getPaymentMethodLabel(paymentMethod);
  const selectedMethodConfigured = isMethodConfigured(paymentMethod, {
    accountName,
    accountNumber,
    transferReference,
    cardHolderName,
    cardNumber,
    cardExpiry,
    cardCvv,
  });

  const handleMethodPress = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setDetailsModalMethod(method);
    setError("");
  };

  const handlePayment = async () => {
    let sanitizedValues;
    try {
      sanitizedValues = sanitizePaymentValues(paymentMethod, {
        accountName,
        accountNumber,
        transferReference,
        cardHolderName,
        cardNumber,
        cardExpiry,
        cardCvv,
      });
    } catch (inputError) {
      setError(inputError instanceof Error ? inputError.message : "Invalid payment details.");
      setDetailsModalMethod(paymentMethod);
      return;
    }

    const validationError = getPaymentValidationError(paymentMethod, sanitizedValues);
    if (validationError) {
      setError(validationError);
      setDetailsModalMethod(paymentMethod);
      return;
    }

    setAccountName(sanitizedValues.accountName);
    setAccountNumber(sanitizedValues.accountNumber);
    setTransferReference(sanitizedValues.transferReference);
    setCardHolderName(sanitizedValues.cardHolderName);
    setCardNumber(sanitizedValues.cardNumber);
    setCardExpiry(sanitizedValues.cardExpiry);
    setCardCvv(sanitizedValues.cardCvv);
    setError("");
    setLoading(true);

    try {
      const voucherCode = generateVoucherCode(workspace.id);
      const bankDepositId = generateBankDepositId(workspace.id);
      const paymentDetails = getPaymentPayload(paymentMethod, sanitizedValues);
      const referenceNumber = paymentDetails.referenceNumber;

      let startDateTime: string;
      let endDateTime: string;
      if (booking.mode === "office") {
        const monthDate = new Date(booking.month + " 1");
        startDateTime = `${monthDate.toISOString().split('T')[0]}T09:00:00`;
        const endMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        endDateTime = `${endMonth.toISOString().split('T')[0]}T17:00:00`;
      } else {
        startDateTime = `${booking.dates[0]}T${booking.slot.split(' - ')[0]}:00`;
        endDateTime = `${booking.dates[booking.dates.length - 1]}T${booking.slot.split(' - ')[1]}:00`;
      }

      await createBooking(workspace.id, startDateTime, endDateTime, {
        notes: `Payment via ${getPaymentMethodLabel(paymentMethod)}`,
        guest: {
          name: sanitizeNameInput(booking.guest.name, "Guest name"),
          email: booking.guest.email,
          phone: sanitizePhoneInput(booking.guest.phone),
        },
        payment: {
          method: getPaymentMethodLabel(paymentMethod),
          amount: bookingAmount,
          voucherCode,
          bankDepositId,
          referenceNumber,
        },
      });
      const nextVoucher = await createLocalPaymentVoucher({
        amount: bookingAmount,
        paymentMethod: getPaymentMethodLabel(paymentMethod),
        workspaceName: workspace.name,
        bookingSummary,
        voucherCode,
        referenceNumber,
        bankDepositId,
      });
      setVoucher(nextVoucher);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Payment</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          <Text style={styles.bodyText}>Space: {workspace.name}</Text>
          <Text style={styles.bodyText}>Type: {workspace.type}</Text>
          {booking.mode === "office" ? (
            <Text style={styles.bodyText}>Month: {booking.month}</Text>
          ) : (
            <>
              <Text style={styles.bodyText}>Dates: {booking.dates.join(", ")}</Text>
              <Text style={styles.bodyText}>Time: {booking.slot}</Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Guest Info</Text>
          <Text style={styles.bodyText}>Name: {booking.guest.name}</Text>
          <Text style={styles.bodyText}>Email: {booking.guest.email}</Text>
          <Text style={styles.bodyText}>Phone: {booking.guest.phone}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.methodList}>
            {PAYMENT_METHODS.map((method) => {
              const active = paymentMethod === method.key;
              return (
                <Pressable
                  key={method.key}
                  style={[styles.methodCard, active && styles.methodCardActive]}
                  onPress={() => handleMethodPress(method.key)}
                >
                  <View style={styles.methodHeader}>
                    <Text style={[styles.methodTitle, active && styles.methodTitleActive]}>
                      {method.label}
                    </Text>
                  </View>
                  <Text style={styles.methodHelper}>{method.helper}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.selectedMethodBox}>
            <Text style={styles.infoLabel}>Selected Method</Text>
            <Text style={styles.selectedMethodValue}>{selectedMethodLabel}</Text>
            <Text style={styles.infoHint}>
              {selectedMethodConfigured
                ? "Payment details have been added for this method."
                : "Tap the button below to enter the required payment details."}
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => setDetailsModalMethod(paymentMethod)}
            >
              <Text style={styles.secondaryButtonText}>
                {selectedMethodConfigured ? "Edit Payment Details" : "Add Payment Details"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Amount Payable</Text>
            <Text style={styles.infoValue}>PKR {bookingAmount.toFixed(2)}</Text>
            <Text style={styles.infoHint}>
              {paymentMethod === "cash-counter"
                ? "Your voucher will be generated now and payment can be completed at the counter."
                : "A payment voucher will be generated as soon as the booking is confirmed."}
            </Text>
          </View>

          {!voucher ? (
            <Pressable style={styles.payButton} onPress={handlePayment} disabled={loading}>
              <Text style={styles.payButtonText}>{loading ? "Processing..." : "Confirm Booking & Generate Voucher"}</Text>
            </Pressable>
          ) : null}
          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {voucher ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Voucher</Text>
            <View style={styles.voucherBanner}>
              <Text style={styles.voucherLabel}>Voucher Code</Text>
              <Text style={styles.voucherCode}>{voucher.voucherCode}</Text>
            </View>
            <Text style={styles.bodyText}>Space: {voucher.workspaceName}</Text>
            <Text style={styles.bodyText}>Booking: {voucher.bookingSummary}</Text>
            <Text style={styles.bodyText}>Method: {voucher.paymentMethod}</Text>
            <Text style={styles.bodyText}>Reference: {voucher.referenceNumber}</Text>
            <Text style={styles.bodyText}>Bank Deposit ID: {voucher.bankDepositId ?? "N/A"}</Text>
            <Text style={styles.bodyText}>Amount: PKR {Number(voucher.amount ?? 0).toFixed(2)}</Text>
            <Text style={styles.bodyText}>Issued: {formatDate(voucher.paidAt)}</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.secondaryButton, styles.rowItem]}
                onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
              >
                <Text style={styles.secondaryButtonText}>Back To Home</Text>
              </Pressable>
              <Pressable
                style={[styles.payButton, styles.rowItem, styles.payButtonCompact]}
                onPress={() => navigation.navigate("MainTabs", { screen: "MyPayments" })}
              >
                <Text style={styles.payButtonText}>View Payments</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={detailsModalMethod !== null}
        onRequestClose={() => setDetailsModalMethod(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          // behavior={Platform.OS == "android" ? "padding" :"height"}
        >
          <View style={styles.modalBackdrop}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {detailsModalMethod ? getPaymentMethodLabel(detailsModalMethod) : "Payment Details"}
                </Text>
                <Text style={styles.modalMessage}>
                  {detailsModalMethod
                    ? getPaymentMethodDescription(detailsModalMethod)
                    : "Enter your payment details."}
                </Text>

                {detailsModalMethod === "credit-debit-card" ? (
                  <>
                    <Text style={styles.label}>Card Holder Name</Text>
                    <TextInput
                      value={cardHolderName}
                      onChangeText={(value) =>
                        setCardHolderName(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.cardHolderName }))
                      }
                      placeholder="Full name on card"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={INPUT_LIMITS.cardHolderName}
                      style={styles.input}
                    />

                    <Text style={styles.label}>Card Number</Text>
                    <TextInput
                      value={cardNumber}
                      onChangeText={(value) =>
                        setCardNumber(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.cardNumber }))
                      }
                      placeholder="4111 1111 1111 1111"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      maxLength={INPUT_LIMITS.cardNumber}
                      style={styles.input}
                    />

                    <View style={styles.row}>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>Expiry Date</Text>
                        <TextInput
                          value={cardExpiry}
                          onChangeText={(value) =>
                            setCardExpiry(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.cardExpiry }))
                          }
                          placeholder="MM/YY"
                          placeholderTextColor={colors.mutedForeground}
                          maxLength={INPUT_LIMITS.cardExpiry}
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>CVV</Text>
                        <TextInput
                          value={cardCvv}
                          onChangeText={(value) =>
                            setCardCvv(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.cardCvv }))
                          }
                          placeholder="123"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="number-pad"
                          secureTextEntry
                          maxLength={INPUT_LIMITS.cardCvv}
                          style={styles.input}
                        />
                      </View>
                    </View>
                  </>
                ) : null}

                {detailsModalMethod === "easypaisa" || detailsModalMethod === "quick-pay" ? (
                  <>
                    <Text style={styles.label}>Payer Name</Text>
                    <TextInput
                      value={accountName}
                      onChangeText={(value) =>
                        setAccountName(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.name }))
                      }
                      placeholder="Full name"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={INPUT_LIMITS.name}
                      style={styles.input}
                    />

                    <Text style={styles.label}>Wallet / Phone Number</Text>
                    <TextInput
                      value={accountNumber}
                      onChangeText={(value) =>
                        setAccountNumber(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.accountNumber }))
                      }
                      placeholder="03xx xxxxxxx"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                      maxLength={INPUT_LIMITS.accountNumber}
                      style={styles.input}
                    />
                  </>
                ) : null}

                {detailsModalMethod === "bank-transfer" ? (
                  <>
                    <Text style={styles.label}>Account Holder Name</Text>
                    <TextInput
                      value={accountName}
                      onChangeText={(value) =>
                        setAccountName(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.name }))
                      }
                      placeholder="Full name"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={INPUT_LIMITS.name}
                      style={styles.input}
                    />

                    <Text style={styles.label}>Bank Account / IBAN</Text>
                    <TextInput
                      value={accountNumber}
                      onChangeText={(value) =>
                        setAccountNumber(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.accountNumber }))
                      }
                      placeholder="PK00 WORK 0000 1234 5678"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={INPUT_LIMITS.accountNumber}
                      style={styles.input}
                    />

                    <Text style={styles.label}>Transfer Reference</Text>
                    <TextInput
                      value={transferReference}
                      onChangeText={(value) =>
                        setTransferReference(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.transferReference }))
                      }
                      placeholder="TRX-123456"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={INPUT_LIMITS.transferReference}
                      style={styles.input}
                    />
                  </>
                ) : null}

                {detailsModalMethod === "cash-counter" ? (
                  <>
                    <Text style={styles.label}>Payer Name</Text>
                    <TextInput
                      value={accountName}
                      onChangeText={(value) =>
                        setAccountName(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.name }))
                      }
                      placeholder="Full name"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={INPUT_LIMITS.name}
                      style={styles.input}
                    />
                    <Text style={styles.infoHint}>
                      Your counter reference will be generated automatically after confirmation.
                    </Text>
                  </>
                ) : null}

                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setDetailsModalMethod(null)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalPrimaryButton]}
                    onPress={() => {
                      setError("");
                      setDetailsModalMethod(null);
                    }}
                  >
                    <Text style={styles.modalPrimaryText}>Save Details</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function getPaymentMethodLabel(method: PaymentMethod) {
  return PAYMENT_METHODS.find((item) => item.key === method)?.label ?? method;
}

function generateVoucherCode(workspaceId: number) {
  return `WN-${workspaceId}-${String(Date.now()).slice(-6)}`;
}

function generateBankDepositId(workspaceId: number) {
  return `BD-${workspaceId}-${String(Date.now()).slice(-8)}`;
}

function getPaymentMethodDescription(method: PaymentMethod) {
  switch (method) {
    case "credit-debit-card":
      return "Enter your card number, expiry date, CVV, and card holder name.";
    case "bank-transfer":
      return "Enter the account holder name, IBAN, and transfer reference.";
    case "cash-counter":
      return "Enter the payer name to generate a counter payment reference.";
    case "easypaisa":
    case "quick-pay":
      return "Enter the payer name and wallet or phone number.";
    default:
      return "Enter your payment details.";
  }
}

function sanitizePaymentValues(
  method: PaymentMethod,
  values: {
    accountName: string;
    accountNumber: string;
    transferReference: string;
    cardHolderName: string;
    cardNumber: string;
    cardExpiry: string;
    cardCvv: string;
  }
) {
  const nextValues = {
    accountName: values.accountName,
    accountNumber: values.accountNumber,
    transferReference: values.transferReference,
    cardHolderName: values.cardHolderName,
    cardNumber: values.cardNumber,
    cardExpiry: values.cardExpiry,
    cardCvv: values.cardCvv,
  };

  switch (method) {
    case "credit-debit-card":
      return {
        ...nextValues,
        cardHolderName: sanitizeCardHolderName(values.cardHolderName),
        cardNumber: sanitizeCardNumberInput(values.cardNumber),
        cardExpiry: sanitizeCardExpiryInput(values.cardExpiry),
        cardCvv: sanitizeCardCvvInput(values.cardCvv),
      };
    case "bank-transfer":
      return {
        ...nextValues,
        accountName: sanitizeNameInput(values.accountName, "Account holder name"),
        accountNumber: sanitizeAccountNumberInput(values.accountNumber, "Bank account / IBAN"),
        transferReference: sanitizeTransferReferenceInput(values.transferReference),
      };
    case "cash-counter":
      return {
        ...nextValues,
        accountName: sanitizeNameInput(values.accountName, "Payer name"),
      };
    case "easypaisa":
    case "quick-pay":
      return {
        ...nextValues,
        accountName: sanitizeNameInput(values.accountName, "Payer name"),
        accountNumber: sanitizePhoneInput(values.accountNumber, "Wallet / phone number"),
      };
    default:
      return nextValues;
  }
}

function isMethodConfigured(
  method: PaymentMethod,
  values: {
    accountName: string;
    accountNumber: string;
    transferReference: string;
    cardHolderName: string;
    cardNumber: string;
    cardExpiry: string;
    cardCvv: string;
  },
) {
  switch (method) {
    case "credit-debit-card":
      return !!(
        values.cardHolderName.trim() &&
        values.cardNumber.trim() &&
        values.cardExpiry.trim() &&
        values.cardCvv.trim()
      );
    case "bank-transfer":
      return !!(
        values.accountName.trim() &&
        values.accountNumber.trim() &&
        values.transferReference.trim()
      );
    case "cash-counter":
      return !!values.accountName.trim();
    case "easypaisa":
    case "quick-pay":
      return !!(values.accountName.trim() && values.accountNumber.trim());
    default:
      return false;
  }
}

function getPaymentValidationError(
  method: PaymentMethod,
  values: {
    accountName: string;
    accountNumber: string;
    transferReference: string;
    cardHolderName: string;
    cardNumber: string;
    cardExpiry: string;
    cardCvv: string;
  },
) {
  switch (method) {
    case "credit-debit-card":
      if (!values.cardHolderName.trim()) return "Please enter the card holder name.";
      if (!values.cardNumber.trim()) return "Please enter the card number.";
      if (!values.cardExpiry.trim()) return "Please enter the card expiry date.";
      if (!values.cardCvv.trim()) return "Please enter the card CVV.";
      return "";
    case "bank-transfer":
      if (!values.accountName.trim()) return "Please enter the account holder name.";
      if (!values.accountNumber.trim()) return "Please provide the bank account or IBAN.";
      if (!values.transferReference.trim()) return "Please enter the bank transfer reference number.";
      return "";
    case "cash-counter":
      if (!values.accountName.trim()) return "Please enter the payer name.";
      return "";
    case "easypaisa":
    case "quick-pay":
      if (!values.accountName.trim()) return "Please enter the payer name.";
      if (!values.accountNumber.trim()) return "Please provide the wallet or phone number.";
      return "";
    default:
      return "Please enter payment details.";
  }
}

function getPaymentPayload(
  method: PaymentMethod,
  values: {
    accountName: string;
    accountNumber: string;
    transferReference: string;
    cardHolderName: string;
    cardNumber: string;
    cardExpiry: string;
    cardCvv: string;
  },
) {
  if (method === "cash-counter") {
    return {
      referenceNumber: `COUNTER-${String(Date.now()).slice(-6)}`,
    };
  }

  if (method === "credit-debit-card") {
    const digitsOnly = values.cardNumber.replace(/\s+/g, "");
    const lastFour = digitsOnly.slice(-4) || "0000";
    return {
      referenceNumber: `CARD-${lastFour}`,
    };
  }

  return {
    referenceNumber: values.transferReference.trim() || values.accountNumber.trim(),
  };
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.foreground, marginTop: 6 },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  bodyText: { color: colors.mutedForeground, fontSize: 14 },
  methodList: {
    gap: 10,
    marginTop: 4,
  },
  methodCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    padding: 12,
    gap: 4,
  },
  methodHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  methodCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  methodTitle: { color: colors.foreground, fontSize: 15, fontWeight: "700" },
  methodTitleActive: { color: colors.primary },
  methodHelper: { color: colors.mutedForeground, fontSize: 12 },
  label: { color: colors.foreground, fontWeight: "600", fontSize: 13, marginTop: 6 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.muted,
    color: colors.foreground,
  },
  selectedMethodBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    padding: 12,
    gap: 6,
  },
  selectedMethodValue: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  row: { flexDirection: "row", gap: 10 },
  rowItem: { flex: 1 },
  infoBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    padding: 12,
    gap: 4,
  },
  infoLabel: { color: colors.mutedForeground, fontSize: 12, fontWeight: "700" },
  infoValue: { color: colors.foreground, fontSize: 22, fontWeight: "800" },
  infoHint: { color: colors.mutedForeground, fontSize: 12 },
  payButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  payButtonCompact: {
    marginTop: 0,
  },
  payButtonText: { color: colors.background, fontWeight: "800" },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.foreground, fontWeight: "700" },
  voucherBanner: {
    borderRadius: 16,
    backgroundColor: colors.primary,
    padding: 14,
    gap: 4,
    marginBottom: 4,
  },
  voucherLabel: { color: colors.background, fontSize: 12, fontWeight: "700", opacity: 0.9 },
  voucherCode: { color: colors.background, fontSize: 22, fontWeight: "800" },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalScrollView: {
    width: "100%",
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.foreground,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  modalPrimaryButton: {
    backgroundColor: colors.primary,
  },
  modalCancelText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  modalPrimaryText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "800",
  },
});
