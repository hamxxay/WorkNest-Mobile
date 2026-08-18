import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { getQuotationById, submitModifiedOrder } from "../../services/mockQuotationService";
import { simulateOrderModifiedNotification } from "../../services/mockNotificationService";
import type { QuotationItem } from "../../data/mockQuotationData";
import type { AppStackParamList } from "../../navigation/types";

type EditableItem = QuotationItem & { quantityStr: string; error: string };

export default function ModifyOrderScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "ModifyOrder">>();
  const { quotationId } = route.params;

  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getQuotationById(quotationId)
      .then((q) => setItems(q.items.map((i) => ({ ...i, quantityStr: String(i.quantity), error: "" }))))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [quotationId]);

  function updateQty(id: number, raw: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const qty = parseInt(raw, 10);
        const err = !raw.trim() || isNaN(qty) || qty < 1 ? "Quantity must be at least 1." : "";
        const total = !err ? qty * item.price : item.total;
        return { ...item, quantityStr: raw, quantity: err ? item.quantity : qty, total, error: err };
      })
    );
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function addItem() {
    const newId = Date.now();
    setItems((prev) => [
      ...prev,
      { id: newId, name: "", quantity: 1, price: 0, total: 0, quantityStr: "1", error: "" },
    ]);
  }

  function updateItemName(id: number, name: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, name } : i)));
  }

  function updateItemPrice(id: number, raw: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const price = parseFloat(raw) || 0;
        return { ...i, price, total: price * i.quantity };
      })
    );
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0);

  async function handleSubmit() {
    const hasErrors = items.some((i) => !!i.error || !i.name.trim());
    if (hasErrors) { setError("Please fix all errors before submitting."); return; }
    if (items.length === 0) { setError("At least one item is required."); return; }
    setError("");
    setSubmitting(true);
    try {
      await submitModifiedOrder(quotationId, items.map(({ id, name, quantity, price, total }) => ({ id, name, quantity, price, total })));
      await simulateOrderModifiedNotification(quotationId);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (submitted) {
    return (
      <Screen>
        <View style={s.center}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={s.successTitle}>Order Modified!</Text>
          <Text style={s.successBody}>Your modified order has been submitted. Our team will review and send you an updated quotation.</Text>
          <Pressable style={s.primaryBtn} onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}>
            <Text style={s.primaryBtnText}>Back to Home</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={s.topBar}>
            <Pressable style={s.topBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={s.topTitle}>Modify Order</Text>
            <View style={{ width: 36 }} />
          </View>

          <Text style={s.subtitle}>Edit quantities, remove items, or add new ones for <Text style={s.ref}>{quotationId}</Text>.</Text>

          {/* Items */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Items</Text>
            {items.map((item, idx) => (
              <View key={item.id} style={[s.itemRow, idx < items.length - 1 && s.itemRowBorder]}>
                <View style={s.itemMain}>
                  <TextInput
                    value={item.name}
                    onChangeText={(v) => updateItemName(item.id, v)}
                    placeholder="Item name"
                    placeholderTextColor={colors.mutedForeground}
                    style={s.itemNameInput}
                  />
                  <View style={s.itemMeta}>
                    <View style={s.metaField}>
                      <Text style={s.metaLabel}>Unit Price (PKR)</Text>
                      <TextInput
                        value={item.price > 0 ? String(item.price) : ""}
                        onChangeText={(v) => updateItemPrice(item.id, v)}
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="number-pad"
                        style={s.metaInput}
                      />
                    </View>
                    <View style={s.metaField}>
                      <Text style={s.metaLabel}>Quantity</Text>
                      <View style={s.qtyRow}>
                        <Pressable style={s.qtyBtn} onPress={() => updateQty(item.id, String(Math.max(1, item.quantity - 1)))}>
                          <Ionicons name="remove" size={16} color={colors.foreground} />
                        </Pressable>
                        <TextInput
                          value={item.quantityStr}
                          onChangeText={(v) => updateQty(item.id, v)}
                          keyboardType="number-pad"
                          style={s.qtyInput}
                        />
                        <Pressable style={s.qtyBtn} onPress={() => updateQty(item.id, String(item.quantity + 1))}>
                          <Ionicons name="add" size={16} color={colors.foreground} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={s.metaField}>
                      <Text style={s.metaLabel}>Total</Text>
                      <Text style={s.itemTotal}>PKR {item.total.toLocaleString()}</Text>
                    </View>
                  </View>
                  {!!item.error && <Text style={s.fieldError}>{item.error}</Text>}
                </View>
                <Pressable style={s.removeBtn} onPress={() => removeItem(item.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))}

            <Pressable style={s.addItemBtn} onPress={addItem}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={s.addItemText}>Add Item</Text>
            </Pressable>
          </View>

          {/* Totals */}
          <View style={s.totalsCard}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>PKR {subtotal.toLocaleString()}</Text>
            </View>
            <View style={[s.totalRow, s.grandRow]}>
              <Text style={s.grandLabel}>Grand Total</Text>
              <Text style={s.grandValue}>PKR {subtotal.toLocaleString()}</Text>
            </View>
          </View>

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <Pressable style={[s.primaryBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="checkmark-done-outline" size={18} color="#fff" /><Text style={s.primaryBtnText}>Submit Modified Order</Text></>
            }
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 18, paddingBottom: 36, gap: 14 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 4 },
    topBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    topTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800" },
    subtitle: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
    ref: { color: colors.primary, fontWeight: "700" },
    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
    sectionTitle: { color: colors.foreground, fontSize: 15, fontWeight: "800" },
    itemRow: { flexDirection: "row", gap: 8, paddingVertical: 10, alignItems: "flex-start" },
    itemRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    itemMain: { flex: 1, gap: 8 },
    itemNameInput: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.muted, color: colors.foreground, fontSize: 14 },
    itemMeta: { flexDirection: "row", gap: 8 },
    metaField: { flex: 1, gap: 4 },
    metaLabel: { color: colors.mutedForeground, fontSize: 11, fontWeight: "600" },
    metaInput: { borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: colors.muted, color: colors.foreground, fontSize: 13, textAlign: "center" },
    qtyRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    qtyBtn: { width: 28, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
    qtyInput: { flex: 1, textAlign: "center", color: colors.foreground, fontSize: 13, paddingVertical: 7 },
    itemTotal: { color: colors.primary, fontSize: 13, fontWeight: "700", paddingVertical: 7 },
    fieldError: { color: colors.danger, fontSize: 11 },
    removeBtn: { paddingTop: 10 },
    addItemBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
    addItemText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
    totalsCard: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
    totalRow: { flexDirection: "row", justifyContent: "space-between" },
    totalLabel: { color: colors.mutedForeground, fontSize: 13 },
    totalValue: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
    grandRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    grandLabel: { color: colors.foreground, fontSize: 16, fontWeight: "800" },
    grandValue: { color: colors.primary, fontSize: 18, fontWeight: "800" },
    errorBox: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.dangerMuted, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: colors.danger },
    errorText: { flex: 1, color: colors.danger, fontSize: 13 },
    primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 15 },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    successTitle: { color: colors.foreground, fontSize: 22, fontWeight: "800" },
    successBody: { color: colors.mutedForeground, fontSize: 14, textAlign: "center", lineHeight: 21 },
  });
