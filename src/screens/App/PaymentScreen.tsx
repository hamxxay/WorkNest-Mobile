import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import type { AppStackParamList } from "../../navigation/types";

export default function PaymentScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "Payment">>();
  const { workspace, booking } = route.params;
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

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
          <Text style={styles.label}>Name on Card</Text>
          <TextInput
            value={cardName}
            onChangeText={setCardName}
            placeholder="Full name"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
          <Text style={styles.label}>Card Number</Text>
          <TextInput
            value={cardNumber}
            onChangeText={(value) => setCardNumber(formatCardNumber(value))}
            placeholder="1234 5678 9012 3456"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={19}
            style={styles.input}
          />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Expiry</Text>
              <TextInput
                value={cardExpiry}
                onChangeText={(value) => setCardExpiry(formatExpiry(value))}
                placeholder="MM/YY"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={5}
                style={styles.input}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>CVC</Text>
              <TextInput
                value={cardCvc}
                onChangeText={(value) => setCardCvc(formatCvc(value))}
                placeholder="123"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={4}
                style={styles.input}
              />
            </View>
          </View>
          <Pressable style={styles.payButton}>
            <Text style={styles.payButtonText}>Pay Now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCvc(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

const styles = StyleSheet.create({
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
  row: { flexDirection: "row", gap: 10 },
  rowItem: { flex: 1 },
  payButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  payButtonText: { color: colors.background, fontWeight: "800" },
});
