import { useCallback, useMemo, useState } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import {
  AppHeader,
  AppText,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  DateField,
  Divider,
  EmptyState,
  ErrorState,
  FieldMessage,
  ListSkeleton,
  SelectField,
  StatusPill,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  KYC_REQUIRED,
  KYC_STATUS,
  downloadKycDocument,
  getCustomerKyc,
  getKycDocumentHistory,
  rejectKycDocument,
  toApiDate,
  uploadKycDocument,
  verifyKycDocument,
  type CustomerKyc,
  type KycChecklistItem,
  type KycDocumentTypeOption,
  type KycDocumentVersion,
  type KycFile,
} from "../../../../services/staff";
import { spacing, useTheme } from "../../../../theme";
import { formatDate, formatDateTime } from "../../../../utils/format";
import { CompletenessBar } from "./CompletenessBar";
import { StaffScreen } from "../shared/StaffScreen";
import { isAdminRole, useStaffSession } from "../shared/StaffSession";
import { useAsyncData } from "../shared/hooks";
import { chooseDocumentPhoto, takeDocumentPhoto } from "../shared/photoPicker";
import { useOpenFile } from "../shared/useOpenFile";

type Route = RouteProp<StaffStackParamList, "KycCustomer">;
type KycData = CustomerKyc & { canVerifyAndReject?: boolean };

const NEW_PERSON = -1;
const STATUS_NAMES = ["Pending", "Verified", "Rejected"];

function itemStatus(item: KycChecklistItem): string {
  if (!item.isUploaded || item.status == null) return "Not uploaded";
  return STATUS_NAMES[item.status] ?? "Pending";
}

/**
 * A customer's KYC checklist (GET kyc/{id}): upload a photo per document (POST kyc/upload), view a document and
 * its history, and (admin / super admin) verify or reject it (POST kyc/verify | reject).
 */
export default function KycCustomerScreen() {
  const { params } = useRoute<Route>();
  const toast = useToast();
  const { colors } = useTheme();
  const { role } = useStaffSession();
  const { opening, open } = useOpenFile();

  const fetcher = useCallback(() => getCustomerKyc(params.customerId) as Promise<KycData>, [params.customerId]);
  const { data, loading, refreshing, error, reload, refresh } = useAsyncData(fetcher);

  const [uploadFor, setUploadFor] = useState<KycChecklistItem | null>(null);
  const [verifyDoc, setVerifyDoc] = useState<KycChecklistItem | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [rejectDoc, setRejectDoc] = useState<KycChecklistItem | null>(null);
  const [historyFor, setHistoryFor] = useState<KycChecklistItem | null>(null);

  // The API decides (canVerifyAndReject); the CMS role rule is the fallback.
  const canReview = data?.canVerifyAndReject ?? isAdminRole(role);

  const typesById = useMemo(() => {
    const map = new Map<number, KycDocumentTypeOption>();
    data?.availableDocumentTypes.forEach((t) => map.set(t.id, t));
    return map;
  }, [data]);

  const remarksById = useMemo(() => {
    const map = new Map<number, string>();
    data?.uploadedDocuments.forEach((d) => d.remarks && map.set(d.id, d.remarks));
    return map;
  }, [data]);

  const fileNameById = useMemo(() => {
    const map = new Map<number, string>();
    data?.uploadedDocuments.forEach((d) => map.set(d.id, d.originalFileName));
    return map;
  }, [data]);

  const verify = async () => {
    if (!verifyDoc?.documentId) return;
    setVerifying(true);
    try {
      toast.success(await verifyKycDocument(verifyDoc.documentId));
      setVerifyDoc(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Could not verify the document."));
    } finally {
      setVerifying(false);
    }
  };

  const name = data?.fullName || params.customerName;

  return (
    <StaffScreen>
      <AppHeader title="KYC documents" subtitle={name} />
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="subheading">{data.fullName}</AppText>
                <AppText variant="caption" color="textMuted">
                  {[data.customerCode, data.category].filter(Boolean).join(" · ")}
                </AppText>
              </View>
              <StatusPill status={data.overallStatus} />
            </View>
            <View style={styles.gapTop}>
              <CompletenessBar percent={data.completenessPercentage} />
            </View>
          </Card>

          {data.checklistGroups.length === 0 ? (
            <EmptyState icon="document-outline" title="No KYC documents" message="No documents are set up for this customer's category." />
          ) : (
            data.checklistGroups.map((group, gi) => (
              <Card key={`${group.groupCode ?? "g"}-${gi}`} padding={0}>
                <View style={[styles.groupHeader, { borderBottomColor: colors.border }]}>
                  <Ionicons
                    name={group.isSatisfied ? "checkmark-circle" : "alert-circle-outline"}
                    size={20}
                    color={group.isSatisfied ? colors.success : group.isRequired ? colors.danger : colors.textMuted}
                  />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{group.title}</AppText>
                    {group.statusSummary ? (
                      <AppText variant="caption" color="textMuted">
                        {group.statusSummary}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                {group.items.map((item, ii) => {
                  const status = itemStatus(item);
                  const remarks = item.documentId ? remarksById.get(item.documentId) : undefined;
                  const docKey = `doc-${item.documentId}`;
                  return (
                    <View key={`${item.documentTypeId}-${item.slotNo}-${item.documentId ?? "new"}`}>
                      {ii > 0 ? <Divider inset={16} /> : null}
                      <View style={styles.item}>
                        <View style={styles.row}>
                          <View style={styles.flex}>
                            <AppText variant="bodyStrong">
                              {item.name}
                              {item.requirementLevel === KYC_REQUIRED ? <AppText color="danger"> *</AppText> : null}
                            </AppText>
                            {item.holderName ? (
                              <AppText variant="caption" color="textMuted">
                                {item.holderName}
                              </AppText>
                            ) : null}
                            {item.isUploaded && item.expiryDate ? (
                              <AppText variant="caption" color="textMuted">
                                Expires {formatDate(item.expiryDate)}
                              </AppText>
                            ) : null}
                          </View>
                          <StatusPill status={status === "Pending" ? "Under review" : status} />
                        </View>
                        {item.status === KYC_STATUS.rejected && remarks ? (
                          <AppText variant="caption" color="danger">
                            Rejected: {remarks}
                          </AppText>
                        ) : null}
                        <View style={styles.actions}>
                          {item.documentId ? (
                            <Button
                              title="View"
                              variant="outline"
                              size="sm"
                              leftIcon="eye-outline"
                              loading={opening === docKey}
                              onPress={() =>
                                open(docKey, () => downloadKycDocument(item.documentId as number, fileNameById.get(item.documentId as number)), item.name)
                              }
                            />
                          ) : null}
                          <Button
                            title={item.isUploaded ? "Replace" : "Upload"}
                            variant={item.isUploaded ? "ghost" : "secondary"}
                            size="sm"
                            leftIcon="camera-outline"
                            onPress={() => setUploadFor(item)}
                          />
                          {canReview && item.documentId && item.status === KYC_STATUS.pending ? (
                            <>
                              <Button title="Verify" size="sm" leftIcon="checkmark" onPress={() => setVerifyDoc(item)} />
                              <Button title="Reject" variant="danger" size="sm" leftIcon="close" onPress={() => setRejectDoc(item)} />
                            </>
                          ) : null}
                          {item.documentId ? (
                            <Button title="History" variant="ghost" size="sm" leftIcon="time-outline" onPress={() => setHistoryFor(item)} />
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Card>
            ))
          )}
          <AppText variant="caption" color="textMuted" align="center">
            Photos must be JPG or PNG and under 5 MB. Place the document on a flat surface in good light.
          </AppText>
        </ScrollView>
      ) : null}

      {data && uploadFor ? (
        <UploadSheet
          data={data}
          item={uploadFor}
          docType={typesById.get(uploadFor.documentTypeId)}
          onClose={() => setUploadFor(null)}
          onUploaded={(message) => {
            setUploadFor(null);
            toast.success(message);
            refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        visible={!!verifyDoc}
        title="Verify this document?"
        message={verifyDoc ? `${verifyDoc.name} will be marked as verified.` : undefined}
        confirmLabel="Verify"
        icon="checkmark-circle-outline"
        loading={verifying}
        onCancel={() => setVerifyDoc(null)}
        onConfirm={verify}
      />

      {rejectDoc ? (
        <RejectSheet
          item={rejectDoc}
          onClose={() => setRejectDoc(null)}
          onRejected={(message) => {
            setRejectDoc(null);
            toast.success(message);
            refresh();
          }}
        />
      ) : null}

      {data && historyFor ? (
        <HistorySheet customerId={data.customerId} item={historyFor} onClose={() => setHistoryFor(null)} />
      ) : null}
    </StaffScreen>
  );
}

function UploadSheet({
  data,
  item,
  docType,
  onClose,
  onUploaded,
}: {
  data: CustomerKyc;
  item: KycChecklistItem;
  docType?: KycDocumentTypeOption;
  onClose: () => void;
  onUploaded: (message: string) => void;
}) {
  const slots = data.existingPersonSlots;
  const allowMultiple = !!docType?.allowMultiple;
  const needsHolder = !!docType && (docType.requiresHolderName || docType.allowMultiple);
  const needsExpiry = !!docType?.requiresExpiry;
  const [file, setFile] = useState<KycFile | null>(null);
  const [slotNo, setSlotNo] = useState<number>(item.isUploaded ? item.slotNo : slots[0]?.slotNo ?? (allowMultiple ? NEW_PERSON : 1));
  const [holderName, setHolderName] = useState(item.holderName ?? slots.find((s) => s.slotNo === slotNo)?.holderName ?? "");
  const [expiry, setExpiry] = useState<Date | null>(item.expiryDate ? new Date(item.expiryDate) : null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const slotOptions = useMemo(
    () => [
      ...slots.map((s) => ({ label: s.holderName || s.displayName, value: s.slotNo, description: s.displayName })),
      { label: "New person", value: NEW_PERSON, icon: "person-add-outline" },
    ],
    [slots],
  );

  const pick = async (fromCamera: boolean) => {
    const result = fromCamera ? await takeDocumentPhoto(item.code) : await chooseDocumentPhoto(item.code);
    if (!result) return;
    if ("error" in result) setError(result.error);
    else {
      setError(null);
      setFile(result.file);
    }
  };

  const upload = async () => {
    if (!file) return setError("Take or choose a photo of the document.");
    if (needsHolder && !holderName.trim()) return setError("Enter the holder name for this document.");
    if (needsExpiry && !expiry) return setError("Choose the expiry date of this document.");
    const resolvedSlot = !allowMultiple
      ? 1
      : slotNo === NEW_PERSON
        ? slots.reduce((m, s) => Math.max(m, s.slotNo), 0) + 1
        : slotNo || 1;
    setError(null);
    setProgress(0);
    try {
      const message = await uploadKycDocument(
        {
          customerId: data.customerId,
          documentTypeId: item.documentTypeId,
          slotNo: resolvedSlot,
          holderName: needsHolder ? holderName : undefined,
          expiryDate: expiry ? toApiDate(expiry) : undefined,
          file,
        },
        setProgress,
      );
      onUploaded(message);
    } catch (err) {
      setError(errorMessage(err, "Upload failed. Please try again."));
      setProgress(null);
    }
  };

  const uploading = progress !== null;
  return (
    <BottomSheet
      visible
      onClose={onClose}
      dismissible={!uploading}
      title={item.isUploaded ? "Replace document" : "Upload document"}
      subtitle={item.name}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={uploading} style={styles.flex} />
          <Button
            title={uploading ? `Uploading ${Math.round((progress ?? 0) * 100)}%` : "Upload"}
            onPress={upload}
            loading={uploading}
            disabled={uploading || !file}
            style={styles.flex}
          />
        </>
      }
    >
      {allowMultiple ? (
        <SelectField
          label="Person"
          required
          value={slotNo}
          options={slotOptions}
          onChange={(v) => {
            setSlotNo(v);
            setHolderName(v === NEW_PERSON ? "" : slots.find((s) => s.slotNo === v)?.holderName ?? "");
          }}
        />
      ) : null}
      {needsHolder ? (
        <TextField label="Holder name" required value={holderName} onChangeText={setHolderName} autoCapitalize="words" maxLength={100} />
      ) : null}
      {needsExpiry ? (
        <DateField label="Expiry date" required value={expiry} onChange={setExpiry} minimumDate={new Date()} />
      ) : null}
      <View style={styles.photoRow}>
        <Button title="Take photo" leftIcon="camera-outline" variant="secondary" onPress={() => pick(true)} disabled={uploading} style={styles.flex} />
        <Button title="Gallery" leftIcon="images-outline" variant="outline" onPress={() => pick(false)} disabled={uploading} style={styles.flex} />
      </View>
      {file ? (
        <View style={styles.preview}>
          <Image source={{ uri: file.uri }} style={styles.thumb} resizeMode="cover" accessibilityLabel="Selected photo" />
          <AppText variant="caption" color="textMuted" style={styles.flex} numberOfLines={2}>
            {file.name}
          </AppText>
        </View>
      ) : null}
      <FieldMessage error={error} />
    </BottomSheet>
  );
}

function RejectSheet({
  item,
  onClose,
  onRejected,
}: {
  item: KycChecklistItem;
  onClose: () => void;
  onRejected: (message: string) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!remarks.trim()) return setError("Tell the customer why the document is rejected.");
    setSaving(true);
    setError(null);
    try {
      onRejected(await rejectKycDocument(item.documentId as number, remarks));
    } catch (err) {
      setError(errorMessage(err, "Could not reject the document."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      dismissible={!saving}
      title="Reject document"
      subtitle={item.name}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Reject" variant="danger" onPress={submit} loading={saving} style={styles.flex} />
        </>
      }
    >
      <TextField
        label="Reason"
        required
        value={remarks}
        onChangeText={(t) => {
          setRemarks(t);
          if (error) setError(null);
        }}
        error={error}
        multiline
        rows={3}
        maxLength={500}
        placeholder="e.g. The photo is blurred, please upload a clearer one"
      />
    </BottomSheet>
  );
}

function HistorySheet({ customerId, item, onClose }: { customerId: number; item: KycChecklistItem; onClose: () => void }) {
  const { opening, open } = useOpenFile();
  const fetcher = useCallback(
    () => getKycDocumentHistory(customerId, item.documentTypeId, item.slotNo || 1),
    [customerId, item.documentTypeId, item.slotNo],
  );
  const { data, loading, error, reload } = useAsyncData<KycDocumentVersion[]>(fetcher);
  return (
    <BottomSheet visible onClose={onClose} title="Document history" subtitle={item.name}>
      {loading ? (
        <ListSkeleton rows={2} variant="rows" />
      ) : error ? (
        <ErrorState compact message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState compact title="No versions yet" />
      ) : (
        data.map((v) => (
          <Card key={v.id} variant="outlined">
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">Version {v.versionNo}</AppText>
                <AppText variant="caption" color="textMuted">
                  {[v.uploadedByName, v.uploadedOn ? formatDateTime(v.uploadedOn) : null].filter(Boolean).join(" · ")}
                </AppText>
                {v.remarks ? (
                  <AppText variant="caption" color="textSecondary">
                    {v.remarks}
                  </AppText>
                ) : null}
              </View>
              <StatusPill status={STATUS_NAMES[v.status] === "Pending" ? "Under review" : STATUS_NAMES[v.status] ?? "Pending"} />
            </View>
            <Button
              title="View"
              variant="ghost"
              size="sm"
              leftIcon="eye-outline"
              loading={opening === `v-${v.id}`}
              onPress={() => open(`v-${v.id}`, () => downloadKycDocument(v.id, v.originalFileName), item.name)}
              style={styles.alignStart}
            />
          </Card>
        ))
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  gapTop: { marginTop: spacing.md },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  item: { padding: spacing.lg, gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoRow: { flexDirection: "row", gap: spacing.md },
  preview: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  alignStart: { alignSelf: "flex-start" },
});
