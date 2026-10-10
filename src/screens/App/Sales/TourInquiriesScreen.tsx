import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../components/Screen';
import { Header } from '../../../components/Header';
import { InquiryFeedbackSheet } from '../../../components/InquiryFeedbackSheet';
import { useThemeColors, useThemedStyles } from '../../../theme';
import {
  createTourInquiry,
  getTourInquiries,
  type TourInquiry,
} from '../../../services/contactService';
import {
  formatCreated,
  inquiryFeedbackText,
  isNewInquiry,
  whatsappNumber,
} from '../../../utils/inquiry';

export type InquiryFilter = 'due' | 'new' | 'all';

const PAGE_SIZE = 100;

const FILTERS: { key: InquiryFilter; label: string }[] = [
  { key: 'due', label: 'Follow-ups due' },
  { key: 'new', label: 'New' },
  { key: 'all', label: 'All' },
];

/**
 * Tour Inquiries (sales executives and admins): the "Book a Tour" inquiries with their latest feedback.
 * Due follow-ups come first. Feedback: not interested (reason, closes it), future prospect (follow-up date)
 * or conversion into a quotation (opens Create Quotation; the inquiry is marked converted when it is saved).
 */
export default function TourInquiriesScreen({ navigation, route }: { navigation: any; route: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [items, setItems] = useState<TourInquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InquiryFilter>(route?.params?.filter ?? 'all');
  const [filterChosen, setFilterChosen] = useState(!!route?.params?.filter);
  const [feedbackFor, setFeedbackFor] = useState<TourInquiry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const requestId = useRef(0);

  // Search on the server, a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await getTourInquiries(1, PAGE_SIZE, query || undefined);
        if (id !== requestId.current) return;
        setItems(result.items);
        setTotal(result.total);
        setPage(1);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : 'Could not load the tour inquiries.');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [query],
  );

  // Reload whenever the screen is shown (e.g. back from Create Quotation) and when the search changes.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const loadMore = async () => {
    if (loading || loadingMore || refreshing || items.length >= total) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const result = await getTourInquiries(page + 1, PAGE_SIZE, query || undefined);
      if (id !== requestId.current) return;
      setItems(prev => {
        const seen = new Set(prev.map(i => `${i.id ?? i.publicId}`));
        return [...prev, ...result.items.filter(i => !seen.has(`${i.id ?? i.publicId}`))];
      });
      setTotal(result.total);
      setPage(p => p + 1);
    } catch {
      // the next scroll tries again
    } finally {
      setLoadingMore(false);
    }
  };

  const dueItems = useMemo(() => items.filter(i => i.followUpDue), [items]);
  const newItems = useMemo(() => items.filter(isNewInquiry), [items]);

  // Open on "Follow-ups due" when there are any (unless a tab was chosen).
  useEffect(() => {
    if (!filterChosen && !loading && dueItems.length > 0) setFilter('due');
  }, [filterChosen, loading, dueItems.length]);

  const visible = useMemo(() => {
    if (filter === 'due') return dueItems;
    if (filter === 'new') return newItems;
    // Due follow-ups first so they are seen (same as the website).
    return [...items].sort((a, b) => Number(b.followUpDue) - Number(a.followUpDue));
  }, [filter, items, dueItems, newItems]);

  const counts: Record<InquiryFilter, number> = {
    due: dueItems.length,
    new: newItems.length,
    all: total || items.length,
  };

  const openUrl = async (url: string, failMessage: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Not available', failMessage);
    }
  };

  const call = (item: TourInquiry) => {
    const number = item.phone.replace(/[^\d+]/g, '');
    if (!number) return;
    openUrl(`tel:${number}`, 'This device cannot make phone calls.');
  };

  const whatsapp = (item: TourInquiry) => {
    const number = whatsappNumber(item.phone);
    if (!number) return;
    openUrl(`https://wa.me/${number}`, 'WhatsApp could not be opened.');
  };

  const startQuotation = (item: TourInquiry) => {
    setFeedbackFor(null);
    navigation.navigate('QuotationCreate', {
      fromInquiry: {
        id: item.id,
        publicId: item.publicId,
        name: item.fullName,
        email: item.email,
        phone: item.phone,
      },
    });
  };

  const renderItem = ({ item }: { item: TourInquiry }) => {
    const feedback = inquiryFeedbackText(item);
    const fresh = isNewInquiry(item);
    return (
      <View style={[styles.card, item.followUpDue && styles.cardDue]}>
        <View style={styles.cardTop}>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {item.fullName || 'Unnamed'}
            </Text>
            {item.createdAt ? <Text style={styles.muted}>{formatCreated(item.createdAt)}</Text> : null}
          </View>
          {item.followUpDue ? (
            <View style={[styles.badge, styles.badgeDue]}>
              <Text style={[styles.badgeText, { color: colors.danger }]}>Follow-up due</Text>
            </View>
          ) : fresh ? (
            <View style={[styles.badge, styles.badgeNew]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>New</Text>
            </View>
          ) : null}
        </View>

        {item.phone ? (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.info} selectable>{item.phone}</Text>
          </View>
        ) : null}
        {item.email ? (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.info} selectable numberOfLines={1}>{item.email}</Text>
          </View>
        ) : null}
        {item.message ? <Text style={styles.message} numberOfLines={4}>{item.message}</Text> : null}

        {feedback ? (
          <View style={[styles.feedback, item.followUpDue && styles.feedbackDue]}>
            <Ionicons
              name={
                item.feedbackOutcome === 'converted'
                  ? 'checkmark-circle-outline'
                  : item.feedbackOutcome === 'not_interested'
                    ? 'close-circle-outline'
                    : 'alarm-outline'
              }
              size={15}
              color={item.followUpDue ? colors.danger : colors.primary}
            />
            <Text style={[styles.feedbackText, item.followUpDue && { color: colors.danger }]}>
              {feedback}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, !item.phone && styles.disabled]}
            disabled={!item.phone}
            accessibilityLabel={`Call ${item.fullName}`}
            onPress={() => call(item)}
          >
            <Ionicons name="call-outline" size={16} color={colors.primary} />
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, !item.phone && styles.disabled]}
            disabled={!item.phone}
            accessibilityLabel={`WhatsApp ${item.fullName}`}
            onPress={() => whatsapp(item)}
          >
            <Ionicons name="logo-whatsapp" size={16} color={colors.primary} />
            <Text style={styles.actionText}>WhatsApp</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionPrimary]}
            accessibilityLabel={`Feedback for ${item.fullName}`}
            onPress={() => setFeedbackFor(item)}
          >
            <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.white} />
            <Text style={[styles.actionText, { color: colors.white }]}>Feedback</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.titleRow}>
        <View style={styles.iconBox}>
          <Ionicons name="walk-outline" size={24} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>SALES</Text>
          <Text style={styles.title}>Tour Inquiries</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)} accessibilityLabel="Add inquiry">
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email or phone"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {search ? (
          <Pressable hitSlop={10} onPress={() => setSearch('')} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.segment}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.segmentBtn, active && styles.segmentActive]}
              onPress={() => {
                setFilter(f.key);
                setFilterChosen(true);
              }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                {f.label}
              </Text>
              {!loading ? (
                <View
                  style={[
                    styles.countPill,
                    f.key === 'due' && counts.due > 0 && styles.countPillDue,
                    active && styles.countPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      f.key === 'due' && counts.due > 0 && { color: colors.white },
                      active && { color: colors.primary },
                    ]}
                  >
                    {counts[f.key]}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {notice ? (
        <Pressable style={styles.notice} onPress={() => setNotice(null)}>
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
          <Text style={styles.noticeText}>{notice}</Text>
          <Ionicons name="close" size={16} color={colors.mutedForeground} />
        </Pressable>
      ) : null}

      {error && items.length > 0 ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const empty = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.muted}>Loading tour inquiries…</Text>
    </View>
  ) : error ? (
    <View style={styles.emptyCard}>
      <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
      <Text style={styles.emptyText}>{error}</Text>
      <Pressable style={styles.retryBtn} onPress={() => load()}>
        <Text style={styles.retryBtnText}>Try again</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.emptyCard}>
      <Ionicons name="file-tray-outline" size={28} color={colors.mutedForeground} />
      <Text style={styles.emptyText}>
        {query
          ? 'No inquiries match your search.'
          : filter === 'due'
            ? 'No follow-ups are due. Nice work!'
            : filter === 'new'
              ? 'No new inquiries.'
              : 'No tour inquiries yet.'}
      </Text>
    </View>
  );

  return (
    <Screen>
      <Header />
      <FlatList
        data={visible}
        keyExtractor={(item, index) => `${item.id ?? item.publicId ?? 'inq'}-${index}`}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerSpinner} /> : null
        }
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      <InquiryFeedbackSheet
        visible={!!feedbackFor}
        inquiry={feedbackFor}
        onClose={() => setFeedbackFor(null)}
        onSaved={message => {
          setFeedbackFor(null);
          setNotice(message);
          load();
        }}
        onConvert={startQuotation}
      />

      <AddInquirySheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={message => {
          setShowAdd(false);
          setNotice(message);
          setFilter('new');
          setFilterChosen(true);
          load();
        }}
      />
    </Screen>
  );
}

/** "Add inquiry": a phone call or walk-in, saved through the same endpoint as the website's Book a Tour form. */
function AddInquirySheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setForm({ fullName: '', email: '', phone: '', message: '' });
      setError('');
    }
  }, [visible]);

  const update = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const close = () => {
    if (!savingRef.current) onClose();
  };

  const save = async () => {
    if (savingRef.current) return;
    if (!form.fullName.trim()) return setError('Enter the name.');
    if (!form.phone.trim()) return setError('Enter the phone number.');
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const message = await createTourInquiry(form);
      onSaved(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add the inquiry right now.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    props: React.ComponentProps<typeof TextInput> = {},
  ) => (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={value => update(key, value)}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, props.multiline && styles.textarea]}
        {...props}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>NEW</Text>
              <Text style={styles.sheetTitle}>Add tour inquiry</Text>
            </View>
            <Pressable hitSlop={10} onPress={close} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            {field('fullName', 'Full name *', { placeholder: 'Customer name', autoCapitalize: 'words' })}
            {field('phone', 'Phone *', { placeholder: '03xx xxxxxxx', keyboardType: 'phone-pad' })}
            {field('email', 'Email', {
              placeholder: 'name@example.com',
              keyboardType: 'email-address',
              autoCapitalize: 'none',
              autoCorrect: false,
            })}
            {field('message', 'Message', {
              placeholder: 'What are they looking for? (walk-in / phone call)',
              multiline: true,
            })}
            {error ? <Text style={styles.formError}>{error}</Text> : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.sheetSecondary} onPress={close} disabled={saving}>
                <Text style={styles.sheetSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.sheetPrimary, saving && styles.disabled]} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.sheetPrimaryText}>Add inquiry</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
    headerWrap: { paddingTop: 18, gap: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.mutedForeground, fontWeight: '700' },
    title: { fontSize: 26, fontWeight: '800', color: colors.foreground, letterSpacing: -0.7, marginTop: 2 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    addText: { color: colors.white, fontSize: 14, fontWeight: '800' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, minHeight: 44, fontSize: 14, color: colors.foreground },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 38,
      borderRadius: 9,
      paddingHorizontal: 6,
    },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, flexShrink: 1 },
    segmentTextActive: { color: colors.white },
    countPill: {
      minWidth: 22,
      paddingHorizontal: 6,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countPillDue: { backgroundColor: colors.danger },
    countPillActive: { backgroundColor: colors.white },
    countText: { fontSize: 11, fontWeight: '800', color: colors.foreground },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.successMuted,
      borderRadius: 10,
      padding: 10,
    },
    noticeText: { flex: 1, fontSize: 13, color: colors.foreground },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.dangerMuted,
      borderRadius: 10,
      padding: 10,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: 13 },
    retryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    center: { alignItems: 'center', gap: 8, paddingVertical: 32 },
    footerSpinner: { marginVertical: 16 },
    muted: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 8,
    },
    cardDue: { borderColor: colors.danger, borderWidth: 1.5 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    name: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    badgeDue: { backgroundColor: colors.dangerMuted },
    badgeNew: { backgroundColor: colors.accentMuted },
    badgeText: { fontSize: 11, fontWeight: '800' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    info: { flex: 1, fontSize: 14, color: colors.foreground },
    message: { fontSize: 13, color: colors.mutedForeground, lineHeight: 19 },
    feedback: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    feedbackDue: { backgroundColor: colors.dangerMuted },
    feedbackText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.accent },
    actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryMuted,
    },
    actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    disabled: { opacity: 0.5 },
    emptyCard: {
      backgroundColor: colors.muted,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: 'center',
      gap: 10,
    },
    emptyText: { color: colors.mutedForeground, fontSize: 14, textAlign: 'center' },
    retryBtn: {
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
    // Add inquiry sheet
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '90%',
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.foreground, marginTop: 2 },
    sheetBody: { gap: 12, paddingBottom: 8 },
    fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      minHeight: 46,
      color: colors.foreground,
      backgroundColor: colors.card,
    },
    textarea: { minHeight: 92, textAlignVertical: 'top' },
    formError: { fontSize: 14, fontWeight: '600', color: colors.danger },
    sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    sheetPrimary: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetPrimaryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
    sheetSecondary: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetSecondaryText: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  });
