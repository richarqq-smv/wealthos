import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

export type PickCsvResult =
  | { ok: true; text: string; fileName: string }
  | { ok: false; reason: "cancelled" | "read-error" };

export async function pickRevolutCsvFile(): Promise<PickCsvResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "application/csv", "*/*"],
    copyToCacheDirectory: true,
  });

  if (picked.canceled || picked.assets.length === 0) {
    return { ok: false, reason: "cancelled" };
  }

  const asset = picked.assets[0];
  if (!asset) return { ok: false, reason: "cancelled" };

  try {
    const text =
      Platform.OS === "web"
        ? await fetch(asset.uri).then((response) => response.text())
        : await FileSystem.readAsStringAsync(asset.uri);
    return { ok: true, text, fileName: asset.name };
  } catch {
    return { ok: false, reason: "read-error" };
  }
}
