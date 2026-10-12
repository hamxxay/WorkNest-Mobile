import { Linking, PermissionsAndroid, Platform, Alert } from "react-native";
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

/** Asks the user to open Settings after camera access was denied (a decision, so a dialog). */
function showCameraSettings() {
  Alert.alert("Camera access needed", "Allow camera access in Settings to photograph the document.", [
    { text: "Not now", style: "cancel" },
    { text: "Open Settings", onPress: () => Linking.openSettings().catch(() => undefined) },
  ]);
}

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: "Camera access",
    message: "WorkNest uses the camera to photograph KYC documents.",
    buttonPositive: "Allow",
    buttonNegative: "Not now",
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
  showCameraSettings();
  return false;
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

/** Result: the file, null when cancelled, or an error message. */
export type PickResult = { file: KycFile } | { error: string } | null;

function handle(res: ImagePickerResponse, code: string): PickResult {
  if (res.didCancel) return null;
  if (res.errorCode === "permission") {
    showCameraSettings();
    return null;
  }
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
    if (!(await ensureCameraPermission())) return null;
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
