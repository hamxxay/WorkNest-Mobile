import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { Screen } from '../../../components/Screen';
import { Header } from '../../../components/Header';
import { useThemeColors, useThemedStyles } from '../../../theme';
import type { AppStackParamList } from '../../../navigation/types';
import {
  getCustomerKyc,
  uploadKycDocument,
  KYC_MAX_FILE_BYTES,
  KYC_REQUIRED,
  KYC_STATUS,
  type CustomerKyc,
  type KycChecklistItem,
  type KycDocumentTypeOption,
  type KycFile,
} from '../../../services/kycService';

type Props = NativeStackScreenProps<AppStackParamList, 'KycDocuments'>;
type Colors = ReturnType<typeof useThemeColors>;

// Small enough for the 5 MB API limit, sharp enough to read a CNIC.
const PHOTO_OPTIONS = { mediaType: 'photo', quality: 0.8, maxWidth: 2000, maxHeight: 2000 } as const;
const CAMERA_OPTIONS: CameraOptions = { ...PHOTO_OPTIONS, cameraType: 'back', saveToPhotos: false };
const LIBRARY_OPTIONS: ImageLibraryOptions = {
  ...PHOTO_OPTIONS,
  selectionLimit: 1,
  restrictMimeTypes: ['image/jpeg', 'image/png'],
  assetRepresentationMode: 'compatible', // iOS: HEIC photos come back as JPEG
};

const NEW_PERSON = -1;

function showCameraSettingsAlert() {
  Alert.alert(
    'Camera access needed',
    'Allow camera access in Settings to take a photo of the document.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
    ],
  );
}

/** Android asks at runtime because the manifest declares CAMERA; iOS asks inside launchCamera. */
async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
  if (granted) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera access',
    message: 'WorkNest uses the camera to photograph your KYC documents.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
  showCameraSettingsAlert();
  return false;
}

/** The API accepts .jpg/.jpeg/.png (checked by file signature), so name the file from its real type. */
function toKycFile(asset: Asset, code: string): KycFile | string {
  if (!asset.uri) return 'Could not read the photo. Please try again.';
  const ext = (asset.fileName?.split('.').pop() ?? '').toLowerCase();
  const type = (asset.type ?? '').toLowerCase();
  const isPng = type === 'image/png' || (!type && ext === 'png');
  const isJpeg = type === 'image/jpeg' || type === 'image/jpg' || (!type && (ext === 'jpg' || ext === 'jpeg'));
  if (!isPng && !isJpeg) return 'Please use a JPG or PNG photo.';
  if (asset.fileSize && asset.fileSize > KYC_MAX_FILE_BYTES) {
    return 'This photo is larger than 5 MB. Please retake it or choose a smaller one.';
  }
  const safeCode = (code || 'document').replace(/[^A-Za-z0-9_-]/g, '_');
  return {
    uri: asset.uri,
    name: `${safeCode}_${Date.now()}.${isPng ? 'png' : 'jpg'}`,
    type: isPng ? 'image/png' : 'image/jpeg',
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type StatusView = { label: string; color: string; bg: string; icon: string };

function statusView(item: KycChecklistItem, colors: Colors): StatusView {
  if (!item.isUploaded || item.status == null) {
    return { label: 'Not uploaded', color: colors.mutedForeground, bg: colors.muted, icon: 'cloud-upload-outline' };
  }
  if (item.status === KYC_STATUS.verified) {
    return { label: 'Approved', color: colors.success, bg: colors.successMuted, icon: 'checkmark-circle' };
  }
  if (item.status === KYC_STATUS.rejected) {
    return { label: 'Rejected', color: colors.danger, bg: colors.dangerMuted, icon: 'close-circle' };
  }
  return { label: 'Pending review', color: '#B45309', bg: '#FEF3C7', icon: 'time-outline' };
}

/**
 * KYC Documents: the customer's required documents (from GET /api/kyc/{id}), each with its review status,
 * and a camera / gallery upload per document (POST /api/kyc/upload) — the same flow as the website's KYC page.
 */
export default function KycDocumentsScreen({ route }: Props) {
  const { customerId, customerName } = route.params;
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [data, setData] = useState<CustomerKyc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setData(await getCustomerKyc(customerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load KYC documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const typesById = useMemo(() => {
    const map = new Map<number, KycDocumentTypeOption>();
    data?.availableDocumentTypes.forEach(t => map.set(t.id, t));
    return map;
  }, [data]);

  const remarksById = useMemo(() => {
    const map = new Map<number, string>();
    data?.uploadedDocuments.forEach(d => {
      if (d.remarks) map.set(d.id, d.remarks);
    });
    return map;
  }, [data]);

  /** Runs one upload at a time (guards double taps across all rows). */
  const runUpload = useCallback(
    async (key: string, task: () => Promise<string>): Promise<{ ok: boolean; message: string }> => {
      if (busyRef.current) return { ok: false, message: 'Another upload is in progress.' };
      busyRef.current = true;
      setBusyKey(key);
      try {
        const message = await task();
        await load(true);
        return { ok: true, message };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Upload failed. Please try again.' };
      } finally {
        busyRef.current = false;
        setBusyKey(null);
      }
    },
    [load],
  );

  const name = data?.fullName || customerName;
  const groups = data?.checklistGroups ?? [];

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Ionicons name="id-card-outline" size={24} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>KYC</Text>
            <Text style={styles.title}>KYC Documents</Text>
            {name ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {name}
                {data?.category ? ` · ${data.category}` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Loading KYC documents…</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={[styles.secondaryBtn, styles.selfStart]} onPress={() => load()}>
              <Text style={styles.secondaryText}>Try again</Text>
            </Pressable>
          </View>
        ) : !data || groups.length === 0 ? (
          <View style={[styles.card, styles.centerCard]}>
            <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
            <Text style={styles.muted}>No KYC documents are set up for this customer's category.</Text>
            <Pressable style={styles.secondaryBtn} onPress={() => load()}>
              <Text style={styles.secondaryText}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.flex}>
                <Text style={styles.summaryLabel}>{data.overallStatus}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, data.completenessPercentage))}%` }]} />
                </View>
              </View>
              <Text style={styles.summaryPct}>{data.completenessPercentage}%</Text>
            </View>

            {groups.map((group, gi) => (
              <View key={`${group.groupCode ?? 'g'}-${gi}`} style={styles.card}>
                <View style={styles.groupHeader}>
                  <Ionicons
                    name={group.isSatisfied ? 'checkmark-circle' : 'alert-circle-outline'}
                    size={20}
                    color={group.isSatisfied ? colors.success : group.isRequired ? colors.danger : colors.mutedForeground}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    {group.statusSummary ? <Text style={styles.muted}>{group.statusSummary}</Text> : null}
                  </View>
                </View>

                {group.items.map(item => {
                  const key = `${item.documentTypeId}-${item.slotNo}-${item.documentId ?? 'new'}`;
                  return (
                    <KycItemRow
                      key={key}
                      rowKey={key}
                      item={item}
                      docType={typesById.get(item.documentTypeId)}
                      remarks={item.documentId ? remarksById.get(item.documentId) : undefined}
                      data={data}
                      busyKey={busyKey}
                      runUpload={runUpload}
                    />
                  );
                })}
              </View>
            ))}
          </>
        )}

        <Text style={styles.note}>
          Photos must be JPG or PNG and under 5 MB. Place the document on a flat surface with good light so every detail is readable.
        </Text>
      </ScrollView>
    </Screen>
  );
}

type RowProps = {
  rowKey: string;
  item: KycChecklistItem;
  docType?: KycDocumentTypeOption;
  remarks?: string;
  data: CustomerKyc;
  busyKey: string | null;
  runUpload: (key: string, task: () => Promise<string>) => Promise<{ ok: boolean; message: string }>;
};

function KycItemRow({ rowKey, item, docType, remarks, data, busyKey, runUpload }: RowProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const allowMultiple = !!docType?.allowMultiple;
  const needsHolder = !!docType && (docType.requiresHolderName || docType.allowMultiple);
  const needsExpiry = !!docType?.requiresExpiry;
  const slots = data.existingPersonSlots;

  const [file, setFile] = useState<KycFile | null>(null);
  const [slotNo, setSlotNo] = useState<number>(item.isUploaded ? item.slotNo : slots[0]?.slotNo ?? 1);
  const [holderName, setHolderName] = useState<string>(
    item.holderName ?? slots.find(s => s.slotNo === slotNo)?.holderName ?? '',
  );
  const [expiry, setExpiry] = useState<Date | null>(item.expiryDate ? new Date(item.expiryDate) : null);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const busy = busyKey === rowKey;
  const anyBusy = busyKey !== null;
  const status = statusView(item, colors);
  const isRequired = item.requirementLevel === KYC_REQUIRED;

  const handlePicked = (res: ImagePickerResponse) => {
    if (res.didCancel) return;
    if (res.errorCode === 'permission') {
      showCameraSettingsAlert();
      return;
    }
    if (res.errorCode) {
      setMessage({
        kind: 'error',
        text: res.errorCode === 'camera_unavailable' ? 'No camera is available on this device.' : res.errorMessage || 'Could not get the photo.',
      });
      return;
    }
    const asset = res.assets?.[0];
    if (!asset) return;
    const picked = toKycFile(asset, item.code);
    if (typeof picked === 'string') {
      setMessage({ kind: 'error', text: picked });
      return;
    }
    setMessage(null);
    setFile(picked);
  };

  const takePhoto = async () => {
    if (anyBusy) return;
    try {
      if (!(await ensureCameraPermission())) return;
      handlePicked(await launchCamera(CAMERA_OPTIONS));
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not open the camera.' });
    }
  };

  const chooseFromGallery = async () => {
    if (anyBusy) return;
    try {
      handlePicked(await launchImageLibrary(LIBRARY_OPTIONS));
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not open the gallery.' });
    }
  };

  const selectSlot = (value: number) => {
    setSlotNo(value);
    setHolderName(value === NEW_PERSON ? '' : slots.find(s => s.slotNo === value)?.holderName ?? '');
  };

  const upload = async () => {
    if (!file || anyBusy) return;
    if (needsHolder && !holderName.trim()) {
      setMessage({ kind: 'error', text: 'Enter the holder name for this document.' });
      return;
    }
    if (needsExpiry && !expiry) {
      setMessage({ kind: 'error', text: 'Select the expiry date for this document.' });
      return;
    }
    const resolvedSlot = !allowMultiple
      ? 1
      : slotNo === NEW_PERSON
        ? slots.reduce((m, s) => Math.max(m, s.slotNo), 0) + 1
        : slotNo || 1;

    setMessage(null);
    setProgress(0);
    const result = await runUpload(rowKey, () =>
      uploadKycDocument(
        {
          customerId: data.customerId,
          documentTypeId: item.documentTypeId,
          slotNo: resolvedSlot,
          holderName: needsHolder ? holderName : undefined,
          expiryDate: expiry ? toYmd(expiry) : undefined,
          file,
        },
        setProgress,
      ),
    );
    setMessage({ kind: result.ok ? 'ok' : 'error', text: result.message });
    if (result.ok) setFile(null);
  };

  return (
    <View style={styles.itemBox}>
      <View style={styles.itemRow}>
        <View style={styles.flex}>
          <Text style={styles.itemName}>
            {item.name}
            {isRequired ? <Text style={styles.requiredMark}> *</Text> : null}
          </Text>
          {item.isUploaded && item.expiryDate ? (
            <Text style={styles.muted}>Expires {item.expiryDate.slice(0, 10)}</Text>
          ) : null}
        </View>
        <View style={[styles.chip, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={13} color={status.color} />
          <Text style={[styles.chipText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {item.status === KYC_STATUS.rejected && remarks ? (
        <Text style={styles.rejectReason}>Reason: {remarks}</Text>
      ) : null}

      {file ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: file.uri }} style={styles.preview} resizeMode="cover" accessibilityLabel={`Preview of ${item.name}`} />

          {allowMultiple ? (
            <View style={styles.fieldGap}>
              <Text style={styles.fieldLabel}>Person</Text>
              <View style={styles.row}>
                {slots.map(s => (
                  <Pressable
                    key={s.slotNo}
                    style={[styles.slotChip, slotNo === s.slotNo && styles.slotChipActive]}
                    onPress={() => selectSlot(s.slotNo)}
                    disabled={anyBusy}
                  >
                    <Text style={[styles.slotText, slotNo === s.slotNo && styles.slotTextActive]}>{s.holderName || s.displayName}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.slotChip, (slotNo === NEW_PERSON || slots.length === 0) && styles.slotChipActive]}
                  onPress={() => selectSlot(NEW_PERSON)}
                  disabled={anyBusy}
                >
                  <Text style={[styles.slotText, (slotNo === NEW_PERSON || slots.length === 0) && styles.slotTextActive]}>+ New person</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {needsHolder ? (
            <View style={styles.fieldGap}>
              <Text style={styles.fieldLabel}>Holder name</Text>
              <TextInput
                style={styles.input}
                value={holderName}
                onChangeText={setHolderName}
                placeholder="Name on the document"
                placeholderTextColor={colors.mutedForeground}
                editable={!anyBusy}
                maxLength={150}
              />
            </View>
          ) : null}

          {needsExpiry ? (
            <View style={styles.fieldGap}>
              <Text style={styles.fieldLabel}>Expiry date</Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={expiry ?? new Date()}
                  mode="date"
                  display="compact"
                  minimumDate={new Date()}
                  onChange={(_e, d) => d && setExpiry(d)}
                  style={styles.selfStart}
                />
              ) : (
                <>
                  <Pressable style={styles.input} onPress={() => setShowExpiryPicker(true)} disabled={anyBusy}>
                    <Text style={{ color: expiry ? colors.foreground : colors.mutedForeground }}>
                      {expiry ? toYmd(expiry) : 'Select date'}
                    </Text>
                  </Pressable>
                  {showExpiryPicker ? (
                    <DateTimePicker
                      value={expiry ?? new Date()}
                      mode="date"
                      minimumDate={new Date()}
                      onChange={(e, d) => {
                        setShowExpiryPicker(false);
                        if (e.type === 'set' && d) setExpiry(d);
                      }}
                    />
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              style={[styles.primaryBtn, styles.flex, anyBusy && styles.disabled]}
              disabled={anyBusy}
              onPress={upload}
            >
              {busy ? (
                <View style={styles.inlineRow}>
                  <ActivityIndicator color={colors.white} />
                  <Text style={styles.primaryText}>{progress > 0 ? `${Math.round(progress * 100)}%` : 'Uploading…'}</Text>
                </View>
              ) : (
                <Text style={styles.primaryText}>Upload</Text>
              )}
            </Pressable>
            <Pressable style={[styles.secondaryBtn, anyBusy && styles.disabled]} disabled={anyBusy} onPress={takePhoto}>
              <Text style={styles.secondaryText}>Retake</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, anyBusy && styles.disabled]}
              disabled={anyBusy}
              onPress={() => {
                setFile(null);
                setMessage(null);
              }}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Take photo of ${item.name}`}
            style={[styles.actionBtn, anyBusy && styles.disabled]}
            disabled={anyBusy}
            onPress={takePhoto}
          >
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={styles.actionText}>{item.isUploaded ? 'Retake photo' : 'Take photo'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Choose ${item.name} from gallery`}
            style={[styles.actionBtn, anyBusy && styles.disabled]}
            disabled={anyBusy}
            onPress={chooseFromGallery}
          >
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={styles.actionText}>Gallery</Text>
          </Pressable>
        </View>
      )}

      {message ? (
        <Text style={[styles.status, { color: message.kind === 'ok' ? colors.success : colors.danger }]}>
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    selfStart: { alignSelf: 'flex-start' },
    container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40, gap: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
    iconBox: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.mutedForeground, fontWeight: '700' },
    title: { fontSize: 28, fontWeight: '800', color: colors.foreground, letterSpacing: -0.7, marginTop: 2 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    center: { alignItems: 'center', gap: 8, paddingVertical: 32 },
    centerCard: { alignItems: 'center' },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 12,
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.muted,
      borderRadius: 18,
      padding: 16,
    },
    summaryLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
    summaryPct: { fontSize: 22, fontWeight: '800', color: colors.primary },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
    groupHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    groupTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    itemBox: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 10 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    itemName: { fontSize: 15, fontWeight: '600', color: colors.foreground },
    requiredMark: { color: colors.danger, fontWeight: '800' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    chipText: { fontSize: 12, fontWeight: '700' },
    rejectReason: { fontSize: 13, color: colors.danger, lineHeight: 18 },
    muted: { fontSize: 13, color: colors.mutedForeground, textAlign: 'left' },
    errorText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
    row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionBtn: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 12,
    },
    actionText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    previewWrap: { gap: 10 },
    preview: { width: '100%', aspectRatio: 1.58, borderRadius: 12, backgroundColor: colors.muted },
    fieldGap: { gap: 6 },
    fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.6 },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      justifyContent: 'center',
      color: colors.foreground,
      fontSize: 15,
    },
    slotChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    slotChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    slotText: { fontSize: 13, color: colors.foreground, fontWeight: '600' },
    slotTextActive: { color: colors.white },
    primaryBtn: {
      minHeight: 44,
      minWidth: 96,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
    secondaryBtn: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    disabled: { opacity: 0.55 },
    status: { fontSize: 14, fontWeight: '600' },
    note: { fontSize: 12, color: colors.mutedForeground, marginTop: 6, lineHeight: 18 },
  });
