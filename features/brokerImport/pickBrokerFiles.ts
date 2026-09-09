import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import type { PickedFile } from "./types";

export type PickBrokerFilesResult = { ok: true; files: PickedFile[] } | { ok: false; reason: "cancelled" | "read-error" };

/**
 * Multi-file, binary-safe picker for broker imports (CSV + PDF + XLSX at
 * once) — a real rewrite of the existing single-file, text-only
 * `features/revolutImport/pickRevolutCsvFile.ts` (kept unchanged, still
 * used by the cash-CSV importer), not a tweak of it, since a broker import
 * genuinely needs different capabilities: `multiple: true`, PDF/XLSX MIME
 * types, and base64 (not UTF-8 text) for binary formats.
 */
export async function pickBrokerFiles(): Promise<PickBrokerFilesResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      "text/csv",
      "text/comma-separated-values",
      "application/csv",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "*/*",
    ],
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (picked.canceled || picked.assets.length === 0) {
    return { ok: false, reason: "cancelled" };
  }

  try {
    const files: PickedFile[] = [];
    for (const asset of picked.assets) {
      const isPdfOrXlsx = /\.(pdf|xlsx|xls)$/i.test(asset.name);
      if (isPdfOrXlsx) {
        const base64 =
          Platform.OS === "web"
            ? await fetch(asset.uri)
                .then((r) => r.arrayBuffer())
                .then(arrayBufferToBase64)
            : await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
        files.push({ name: asset.name, content: base64, encoding: "base64" });
      } else {
        const text = Platform.OS === "web" ? await fetch(asset.uri).then((r) => r.text()) : await FileSystem.readAsStringAsync(asset.uri);
        files.push({ name: asset.name, content: text, encoding: "utf8" });
      }
    }
    return { ok: true, files };
  } catch {
    return { ok: false, reason: "read-error" };
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
