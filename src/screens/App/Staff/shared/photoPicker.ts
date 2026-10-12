import { Linking, PermissionsAndroid, Platform } from "react-native";
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from "react-native-image-picker";
import { KYC_MAX_FILE_BYTES, type KycFile } from "../../../../services/staff";

// Camera / gallery photos for KYC documents (JPG / PNG under 5 MB: the API checks the file signature and size).

const PHOTO_OPTIONS = { mediaType: "photo", quality: 0.8, maxWidth: 2000, maxHeight: 2000 } as const;
const CAMERA_OPTIONS: CameraOptions = { ...PHOTO_OPTIONS, cameraType: "back", saveToPhotos: false };
const LIBRARY_OPTIONS: ImageLibraryOptions = {
  ...PHOTO_OPTIONS,
  selectionLimit: 1,
  restrictMimeTypes: ["image/jpeg", "image/png"],
  assetRepresentationMode: "compatible",
};

/** Opens this app's system settings (after camera access was denied). */
export function openAppSettings(): void {
  Linking.openSettings().catch(() => undefined);
}

/** Options for useConfirm() when camera access was denied: confirming should call openAppSettings(). */
export const CAMERA_SETTINGS_CONFIRM = {
  title: "Camera access needed",
  message: "Allow camera access in Settings to photograph the document.",
  confirmLabel: "Open Settings",
  cancelLabel: "Not now",
  icon: "camera-outline",
} as const;

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: "Camera access",
    message: "WorkNest uses the camera to photograph KYC documents.",
    buttonPositive: "Allow",
    buttonNegative: "Not now",
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function toKycFile(asset: Asset, code: string): KycFile | string {
  if (!asset.uri) return "Could not read the photo. Please try again.";
  const ext = (asset.fileName?.split(".").pop() ?? "").toLowerCase();
  const type = (asset.type ?? "").toLowerCase();
  const isPng = type === "image/png" || (!type && ext === "png");
  const isJpeg = type === "image/jpeg" || type === "image/jpg" || (!type && (ext === "jpg" || ext === "jpeg"));
  if (!isPng && !isJpeg) return "Please use a JPG or PNG photo.";
  if (asset.fileSize && asset.fileSize > KYC_MAX_FILE_BYTES) {
    return "This photo is larger than 5 MB. Please retake it or choose a smaller one.";
  }
  const safe = (code || "document").replace(/[^A-Za-z0-9_-]/g, "_");
  return { uri: asset.uri, name: `${safe}_${Date.now()}.${isPng ? "png" : "jpg"}`, type: isPng ? "image/png" : "image/jpeg" };
}

/**
 * Result: the file, null when cancelled, an error message, or `permissionDenied` (camera access refused: ask
 * with useConfirm(CAMERA_SETTINGS_CONFIRM) and call openAppSettings() when confirmed).
 */
export type PickResult = { file: KycFile } | { error: string } | { permissionDenied: true } | null;

function handle(res: ImagePickerResponse, code: string): PickResult {
  if (res.didCancel) return null;
  if (res.errorCode === "permission") return { permissionDenied: true };
  if (res.errorCode) {
    return { error: res.errorCode === "camera_unavailable" ? "No camera is available on this device." : "Could not get the photo." };
  }
  const asset = res.assets?.[0];
  if (!asset) return null;
  const picked = toKycFile(asset, code);
  return typeof picked === "string" ? { error: picked } : { file: picked };
}

export async function takeDocumentPhoto(code: string): Promise<PickResult> {
  try {
    if (!(await ensureCameraPermission())) return { permissionDenied: true };
    return handle(await launchCamera(CAMERA_OPTIONS), code);
  } catch {
    return { error: "Could not open the camera." };
  }
}

export async function chooseDocumentPhoto(code: string): Promise<PickResult> {
  try {
    return handle(await launchImageLibrary(LIBRARY_OPTIONS), code);
  } catch {
    return { error: "Could not open the gallery." };
  }
}
