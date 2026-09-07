import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Screen } from '../../components/Screen';
import { radii, shadows, useThemeColors, useThemedStyles } from '../../theme';
import { getAllQuotations } from '../../services/mockQuotationService';
import type { Quotation } from '../../data/mockQuotationData';
import type { AppStackParamList } from '../../navigation/types';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; icon: string; bg: string; border: string; text: string }
> = {
  active: {
    label: 'Active',
    icon: 'checkmark-circle-outline',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.35)',
    text: '#059669',
  },
  inactive: {
    label: 'Inactive',
    icon: 'close-circle-outline',
    bg: 'rgba(100,116,139,0.1)',
    border: 'rgba(100,116,139,0.35)',
    text: '#64748b',
  },
  pending: {
    label: 'Pending',
    icon: 'time-outline',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.35)',
    text: '#d97706',
  },
  approved: {
    label: 'Approved',
    icon: 'checkmark-circle-outline',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.35)',
    text: '#059669',
  },
  rejected: {
    label: 'Rejected',
    icon: 'close-circle-outline',
    bg: 'rgba(220,38,38,0.1)',
    border: 'rgba(220,38,38,0.35)',
    text: '#dc2626',
  },
  expired: {
    label: 'Expired',
    icon: 'alert-circle-outline',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.35)',
    text: '#d97706',
  },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.active;
}

const STATUS_ACTIONS: Record<
  string,
  {
    label: string;
    icon: string;
    action: 'view' | 'challan' | 'modify' | 'payment';
  }[]
> = {
  active: [
    { label: 'View', icon: 'eye-outline', action: 'view' },
    {
      label: 'Request Challan',
      icon: 'document-text-outline',
      action: 'challan',
    },
    { label: 'Modify', icon: 'create-outline', action: 'modify' },
  ],
  inactive: [{ label: 'View', icon: 'eye-outline', action: 'view' }],
  pending: [
    { label: 'View', icon: 'eye-outline', action: 'view' },
    {
      label: 'Request Challan',
      icon: 'document-text-outline',
      action: 'challan',
    },
    { label: 'Modify', icon: 'create-outline', action: 'modify' },
  ],
  approved: [
    { label: 'View', icon: 'eye-outline', action: 'view' },
    { label: 'Pay Now', icon: 'card-outline', action: 'payment' },
  ],
  rejected: [
    { label: 'View', icon: 'eye-outline', action: 'view' },
    { label: 'Modify & Resubmit', icon: 'create-outline', action: 'modify' },
  ],
  expired: [{ label: 'View', icon: 'eye-outline', action: 'view' }],
};

function formatDate(iso: string) {
  return iso ? iso.split('T')[0] : '';
}

export default function QuotationListScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await getAllQuotations();
      console.log("Qutation",data);
      
      const order = [
        'active',
        'pending',
        'approved',
        'rejected',
        'expired',
        'inactive',
      ];
      setQuotations(
        data.sort((a, b) => {
          const ai = order.indexOf(a.status?.toLowerCase());
          const bi = order.indexOf(b.status?.toLowerCase());
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleAction(
    quotationId: string,
    action: 'view' | 'challan' | 'modify' | 'payment',
  ) {
    const normalizedId = String(quotationId ?? '').trim();
    const routeId = normalizedId.match(/\d+/)?.[0] ?? normalizedId;

    switch (action) {
      case 'view':
        return navigation.navigate('Quotation', { quotationId: routeId });
      case 'challan':
        return navigation.navigate('CustomerInfo', { quotationId: routeId });
      case 'modify':
        return navigation.navigate('ModifyOrder', { quotationId: routeId });
      case 'payment':
        return navigation.navigate('QuotationPayment', { quotationId: routeId });
    }
  }

  function handleBack() {
    // A cold-start deep link creates QuotationList as the first stack route, so
    // there is no previous screen for goBack() to pop. Fall back to Home.
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
    });
  }

  const counts = quotations.reduce((acc, q) => {
    const k = q.status?.toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <Screen>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Loading quotations…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Top bar */}
      <View style={s.topBar}>
        <Pressable style={s.topBackBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={s.topTitle}>My Quotations</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary pills — only show statuses that have items */}
      <View style={s.summaryRow}>
        {Object.keys(STATUS_CONFIG)
          .filter(s => counts[s])
          .map(status => {
            const cfg = getStatusCfg(status);
            return (
              <View
                key={status}
                style={[
                  s.summaryPill,
                  { backgroundColor: cfg.bg, borderColor: cfg.border },
                ]}
              >
                <Text style={[s.summaryCount, { color: cfg.text }]}>
                  {counts[status]}
                </Text>
                <Text style={[s.summaryLabel, { color: cfg.text }]}>
                  {cfg.label}
                </Text>
              </View>
            );
          })}
      </View>

      {error ? (
        <View style={s.errorBox}>
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={colors.danger}
          />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={quotations}
        keyExtractor={q => String(q.id)}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color={colors.mutedForeground}
            />
            <Text style={s.emptyText}>No quotations found.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = getStatusCfg(item.status);
          const actions =
            STATUS_ACTIONS[item.status?.toLowerCase()] ?? STATUS_ACTIONS.active;

          return (
            <Pressable
              style={s.card}
              onPress={() => handleAction(item.id, 'view')}
            >
              {/* Header */}
              <View style={s.cardHeader}>
                <View style={s.cardHeaderLeft}>
                  <Text style={s.cardNumber}>{item.id}</Text>
                  <Text style={s.cardSpace}>
                    {item.customerName || 'Quotation'}
                  </Text>
                  <Text style={s.cardMeta2}>
                    {item.items?.map(i => i.name).join(' · ') || 'Quotation'}
                  </Text>
                </View>

                <View
                  style={[
                    s.statusBadge,
                    { backgroundColor: cfg.bg, borderColor: cfg.border },
                  ]}
                >
                  <Ionicons name={cfg.icon} size={12} color={cfg.text} />
                  <Text style={[s.statusText, { color: cfg.text }]}>
                    {cfg.label}
                  </Text>
                </View>
              </View>

              {/* Dates row */}
              <View style={s.metaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={colors.mutedForeground}
                />

                <Text style={s.metaText}>{formatDate(item.quotationDate)}</Text>

                <View style={s.metaDot} />

                <Ionicons
                  name="time-outline"
                  size={12}
                  color={colors.mutedForeground}
                />

                <Text style={s.metaText}>
                  Valid till {formatDate(item.validUntil)}
                </Text>

                <View style={s.metaSpacer} />

                <Text style={s.cardTotal}>
                  PKR {(item.total ?? 0).toLocaleString()}
                </Text>
              </View>

              {/* Items */}
              <View style={s.metaRow}>
                <Ionicons
                  name="list-outline"
                  size={12}
                  color={colors.mutedForeground}
                />

                <Text style={s.metaText}>
                  {item.items?.length || 0} item
                  {item.items?.length === 1 ? '' : 's'}
                </Text>

                {item.subtotal !== undefined && (
                  <>
                    <View style={s.metaDot} />

                    <Text style={s.metaText}>
                      Subtotal PKR {(item.subtotal ?? 0).toLocaleString()}
                    </Text>
                  </>
                )}

                {item.tax > 0 && (
                  <>
                    <View style={s.metaDot} />

                    <Text style={s.metaText}>
                      Tax PKR {(item.tax ?? 0).toLocaleString()}
                    </Text>
                  </>
                )}
              </View>

              {/* Action chips */}
              <View style={s.actionsRow}>
                {actions.map(a => {
                  const isPrimary =
                    a.action === 'payment' || a.action === 'challan';

                  return (
                    <Pressable
                      key={a.action}
                      style={[s.actionChip, isPrimary && s.actionChipPrimary]}
                      onPress={e => {
                        e.stopPropagation?.();
                        handleAction(item.id, a.action);
                      }}
                    >
                      <Ionicons
                        name={a.icon}
                        size={13}
                        color={isPrimary ? '#fff' : colors.primary}
                      />

                      <Text
                        style={[
                          s.actionChipText,
                          isPrimary && s.actionChipTextPrimary,
                        ]}
                      >
                        {a.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingText: { color: colors.mutedForeground, fontSize: 14 },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 8,
    },
    topBackBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    topTitle: { color: colors.foreground, fontSize: 17, fontWeight: '800' },

    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    summaryPill: {
      minWidth: 70,
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: radii.md,
      borderWidth: 1,
    },
    summaryCount: { fontSize: 18, fontWeight: '900' },
    summaryLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },

    errorBox: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      marginHorizontal: 18,
      marginBottom: 8,
      backgroundColor: colors.dangerMuted,
      borderRadius: radii.md,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: 13 },

    list: { paddingHorizontal: 18, paddingBottom: 32, gap: 12 },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      gap: 10,
    },
    emptyText: { color: colors.mutedForeground, fontSize: 15 },

    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
      ...shadows.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    cardHeaderLeft: { flex: 1, gap: 2, marginRight: 10 },
    cardNumber: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    cardSpace: { color: colors.foreground, fontSize: 15, fontWeight: '800' },
    cardMeta2: { color: colors.mutedForeground, fontSize: 12 },

    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    statusText: { fontSize: 11, fontWeight: '700' },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: colors.mutedForeground, fontSize: 12 },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.mutedForeground,
    },
    metaSpacer: { flex: 1 },
    cardTotal: { color: colors.primary, fontSize: 15, fontWeight: '800' },

    actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    actionChipPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionChipText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
    actionChipTextPrimary: { color: '#fff' },
  });
