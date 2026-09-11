import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Header } from '../../../components/Header';
import { Screen } from '../../../components/Screen';
import { useThemeColors, useThemedStyles } from '../../../theme';
import {
  createQuotation,
  normalizeQuotationPayload,
} from '../../../services/quotationService';
import {
  getCustomers,
  type CustomerRecord,
} from '../../../services/customerService';

const EMPTY_FORM = {
  customerId: '',
  spaceId: '',
  startDateTime: '',
  endDateTime: '',
  perSeatBasePrice: '',
  capacity: '',
  monthlyBasePrice: '',
  maxDiscountPercent: '',
  discountType: 'percentage',
  discountPercentage: '',
  discountValue: '',
  securityDepositOverride: '',
  billingPeriodMonths: '',
  securityDepositMonths: '',
  floorId: '',
  remarks: '',
  validUntil: '',
};

export default function SaleQuotationCreateScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerOptions, setCustomerOptions] = useState<CustomerRecord[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  useEffect(() => {
    const query = customerQuery.trim();
    if (!query) {
      setCustomerOptions([]);
      return;
    }

    let active = true;
    const runSearch = async () => {
      try {
        setCustomerSearchLoading(true);
        const results = await getCustomers(query);
        if (active) {
          setCustomerOptions(Array.isArray(results) ? results : []);
        }
      } catch (error) {
        if (active) {
          setCustomerOptions([]);
        }
      } finally {
        if (active) {
          setCustomerSearchLoading(false);
        }
      }
    };

    const timer = setTimeout(runSearch, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerQuery]);

  const canSubmit = useMemo(() => {
    return [
      form.customerId,
      form.spaceId,
      form.startDateTime,
      form.endDateTime,
      form.perSeatBasePrice,
      form.capacity,
      form.monthlyBasePrice,
      form.maxDiscountPercent,
      form.validUntil,
    ].every(Boolean);
  }, [form]);

  const updateField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert(
        'Missing fields',
        'Please complete the required quotation information.',
      );
      return;
    }

    try {
      setSaving(true);
      const payload = normalizeQuotationPayload({
        ...form,
        discountPercentage: form.discountPercentage || '0',
        discountValue: form.discountValue || '0',
        securityDepositOverride: form.securityDepositOverride || '0',
        billingPeriodMonths: form.billingPeriodMonths || '0',
        securityDepositMonths: form.securityDepositMonths || '0',
        floorId: form.floorId || '0',
        remarks: form.remarks || '',
      });
      await createQuotation(payload);
      Alert.alert(
        'Quotation created',
        'The quotation was saved successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create quotation.';
      Alert.alert('Create quotation failed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <View style={styles.iconBox}>
              <Ionicons
                name="document-text-outline"
                size={24}
                color={colors.white}
              />
            </View>
            <View>
              <Text style={styles.eyebrow}>QUOTATION</Text>
              <Text style={styles.title}>Create Quotation</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>Customer</Text>

            {!selectedCustomer ? (
              <>
                <View style={styles.searchWrap}>
                  <TextInput
                    value={customerQuery}
                    onChangeText={text => {
                      setCustomerQuery(text);
                      if (!text.trim()) {
                        setCustomerOptions([]);
                      }
                    }}
                    placeholder="Search customer by name or email"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    style={[styles.searchInput, { color: colors.foreground }]}
                  />

                  {customerSearchLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
                </View>

                {customerOptions.length > 0 ? (
                  <View style={styles.customerList}>
                    {customerOptions.map(customer => {
                      const customerName = [customer.firstName, customer.lastName]
                        .filter(Boolean)
                        .join(' ')
                        .trim();

                      const customerId = String(customer.id ?? customer.customerId ?? '');

                      return (
                        <TouchableOpacity
                          key={customerId || `${customer.email ?? 'customer'}-${customerName}`}
                          style={styles.customerItem}
                          activeOpacity={0.8}
                          onPress={() => {
                            const selectedId = String(
                              customer.id ?? customer.customerId ?? '',
                            );
                            setSelectedCustomer(customer);
                            setForm(prev => ({ ...prev, customerId: selectedId }));
                            setCustomerQuery('');
                            setCustomerOptions([]);
                          }}
                        >
                          <Text style={styles.customerItemName}>
                            {customerName || 'Customer'}
                          </Text>
                          {customer.email ? (
                            <Text style={styles.customerItemMeta}>{customer.email}</Text>
                          ) : null}
                          {customer.phoneNumber ? (
                            <Text style={styles.customerItemMeta}>
                              {customer.phoneNumber}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : customerQuery.trim() ? (
                  <Text style={styles.emptyCustomerText}>
                    No matching customer found. Create a new customer below.
                  </Text>
                ) : null}
              </>
            ) : (
              <View style={styles.selectedCustomerCard}>
                <Text style={styles.selectedCustomerName}>
                  {[
                    selectedCustomer?.firstName,
                    selectedCustomer?.lastName,
                  ]
                    .filter(Boolean)
                    .join(' ') || 'Customer'}
                </Text>
                {selectedCustomer?.email ? (
                  <Text style={styles.selectedCustomerMeta}>
                    {selectedCustomer.email}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={styles.changeCustomerBtn}
                  onPress={() => {
                    setSelectedCustomer(null);
                    setCustomerQuery('');
                    setCustomerOptions([]);
                    setForm(prev => ({ ...prev, customerId: '' }));
                  }}
                >
                  <Text style={styles.changeCustomerText}>Change customer</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.createCustomerBtn}
              onPress={() => navigation.navigate('CustomerCreate')}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.primary} />
              <Text style={styles.createCustomerText}>Create new customer</Text>
            </TouchableOpacity>

            {selectedCustomer ? null : (
              <Field
                label="Customer ID"
                value={form.customerId}
                onChangeText={value => updateField('customerId', value)}
                keyboardType="numeric"
              />
            )}
            <Field
              label="Space ID"
              value={form.spaceId}
              onChangeText={value => updateField('spaceId', value)}
              keyboardType="numeric"
            />
            <Field
              label="Floor ID"
              value={form.floorId}
              onChangeText={value => updateField('floorId', value)}
              keyboardType="numeric"
            />
            <Field
              label="Start Date Time"
              value={form.startDateTime}
              onChangeText={value => updateField('startDateTime', value)}
              placeholder="2026-08-05T10:00:00Z"
            />
            <Field
              label="End Date Time"
              value={form.endDateTime}
              onChangeText={value => updateField('endDateTime', value)}
              placeholder="2026-08-06T10:00:00Z"
            />
            <Field
              label="Valid Until"
              value={form.validUntil}
              onChangeText={value => updateField('validUntil', value)}
              placeholder="2026-08-12T00:00:00Z"
            />

            <Text style={styles.sectionLabel}>Pricing</Text>
            <Field
              label="Per Seat Base Price"
              value={form.perSeatBasePrice}
              onChangeText={value => updateField('perSeatBasePrice', value)}
              keyboardType="numeric"
            />
            <Field
              label="Capacity"
              value={form.capacity}
              onChangeText={value => updateField('capacity', value)}
              keyboardType="numeric"
            />
            <Field
              label="Monthly Base Price"
              value={form.monthlyBasePrice}
              onChangeText={value => updateField('monthlyBasePrice', value)}
              keyboardType="numeric"
            />
            <Field
              label="Max Discount Percent"
              value={form.maxDiscountPercent}
              onChangeText={value => updateField('maxDiscountPercent', value)}
              keyboardType="numeric"
            />
            <Field
              label="Discount Type"
              value={form.discountType}
              onChangeText={value => updateField('discountType', value)}
              placeholder="percentage or fixed"
            />
            <Field
              label="Discount Percentage"
              value={form.discountPercentage}
              onChangeText={value => updateField('discountPercentage', value)}
              keyboardType="numeric"
            />
            <Field
              label="Discount Value"
              value={form.discountValue}
              onChangeText={value => updateField('discountValue', value)}
              keyboardType="numeric"
            />
            <Field
              label="Security Deposit Override"
              value={form.securityDepositOverride}
              onChangeText={value =>
                updateField('securityDepositOverride', value)
              }
              keyboardType="numeric"
            />
            <Field
              label="Billing Period Months"
              value={form.billingPeriodMonths}
              onChangeText={value => updateField('billingPeriodMonths', value)}
              keyboardType="numeric"
            />
            <Field
              label="Security Deposit Months"
              value={form.securityDepositMonths}
              onChangeText={value =>
                updateField('securityDepositMonths', value)
              }
              keyboardType="numeric"
            />
            <Field
              label="Remarks"
              value={form.remarks}
              onChangeText={value => updateField('remarks', value)}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || !canSubmit}
            activeOpacity={0.9}
          >
            <Text style={styles.submitText}>
              {saving ? 'Saving...' : 'Create Quotation'}
            </Text>
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
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  multiline?: boolean;
  placeholder?: string;
}) {
  const colors = useThemeColors();
  const fieldStyles = useThemedStyles(createStyles);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontWeight: '700',
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[
          fieldStyles.input,
          multiline && fieldStyles.textarea,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { paddingHorizontal: 18, paddingBottom: 32, gap: 16 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    iconBox: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 1,
      color: colors.primary,
      fontWeight: '800',
    },
    title: {
      fontSize: 24,
      fontWeight: '900',
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
      fontWeight: '800',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 12,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      minHeight: 42,
      fontSize: 14,
    },
    customerList: {
      gap: 10,
      marginBottom: 12,
    },
    customerItem: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    customerItemName: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    customerItemMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    emptyCustomerText: {
      color: colors.mutedForeground,
      fontSize: 12,
      marginBottom: 12,
    },
    selectedCustomerCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      padding: 12,
      marginBottom: 12,
    },
    selectedCustomerName: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    selectedCustomerMeta: {
      color: colors.mutedForeground,
      fontSize: 13,
      marginBottom: 10,
    },
    changeCustomerBtn: {
      alignSelf: 'flex-start',
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    changeCustomerText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    createCustomerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 14,
    },
    createCustomerText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
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
      textAlignVertical: 'top',
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginHorizontal: 18,
      marginBottom: 30,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitText: {
      color: colors.white,
      fontWeight: '800',
      fontSize: 14,
    },
  });
