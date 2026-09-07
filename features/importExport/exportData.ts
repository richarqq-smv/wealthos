import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { AccountRepository } from "@/lib/repositories/AccountRepository";
import { BudgetRepository } from "@/lib/repositories/BudgetRepository";
import { InvestmentRepository } from "@/lib/repositories/InvestmentRepository";
import { InvestmentTransactionRepository } from "@/lib/repositories/InvestmentTransactionRepository";
import { LiabilityRepository } from "@/lib/repositories/LiabilityRepository";
import { SettingsRepository } from "@/lib/repositories/SettingsRepository";
import { TransactionRepository } from "@/lib/repositories/TransactionRepository";
import type { ExportPayload } from "@/types/models";

export async function buildExportPayload(): Promise<ExportPayload> {
  const [accounts, investments, investmentTransactions, transactions, budgets, liabilities, settings] =
    await Promise.all([
      AccountRepository.getAll(),
      InvestmentRepository.getAll(),
      InvestmentTransactionRepository.getAll(),
      TransactionRepository.getAll(),
      BudgetRepository.getAll(),
      LiabilityRepository.getAll(),
      SettingsRepository.get(),
    ]);

  const { pinHash: _pinHash, ...settingsWithoutPin } = settings;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts,
    investments,
    investmentTransactions,
    transactions,
    budgets,
    liabilities,
    settings: settingsWithoutPin,
  };
}

/**
 * expo-file-system/expo-sharing have no web implementation, so desktop
 * (Electron, which renders as `web`) and the browser preview use the
 * platform's own download mechanism instead: a Blob + a temporary anchor
 * with `download` set, which Electron intercepts with its native "Save As"
 * dialog. Mobile keeps the original cache-file + share-sheet flow.
 */
function downloadJsonOnWeb(payload: object, fileName: string): string {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

export async function exportDataToFile(): Promise<string> {
  const payload = await buildExportPayload();
  const fileName = `wealthos-export-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === "web") {
    return downloadJsonOnWeb(payload, fileName);
  }

  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/json",
      dialogTitle: "WealthOS-gegevens exporteren",
    });
  }

  return fileUri;
}
