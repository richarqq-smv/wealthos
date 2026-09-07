import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { AccountRepository } from "@/lib/repositories/AccountRepository";
import { BudgetRepository } from "@/lib/repositories/BudgetRepository";
import { InvestmentRepository } from "@/lib/repositories/InvestmentRepository";
import { InvestmentTransactionRepository } from "@/lib/repositories/InvestmentTransactionRepository";
import { LiabilityRepository } from "@/lib/repositories/LiabilityRepository";
import { SettingsRepository } from "@/lib/repositories/SettingsRepository";
import { TransactionRepository } from "@/lib/repositories/TransactionRepository";
import { validateImportPayload } from "@/utils/validation";

export type ImportResult =
  | { success: true }
  | { success: false; reason: "cancelled" }
  | { success: false; reason: "invalid" };

export async function importDataFromFile(): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (picked.canceled || picked.assets.length === 0) {
    return { success: false, reason: "cancelled" };
  }

  const asset = picked.assets[0];
  if (!asset) {
    return { success: false, reason: "cancelled" };
  }

  let raw: string;
  try {
    raw =
      Platform.OS === "web"
        ? await fetch(asset.uri).then((response) => response.text())
        : await FileSystem.readAsStringAsync(asset.uri);
  } catch {
    return { success: false, reason: "invalid" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, reason: "invalid" };
  }

  const result = validateImportPayload(parsed);
  if (!result.success) {
    return { success: false, reason: "invalid" };
  }

  const payload = result.data;
  await Promise.all([
    AccountRepository.replaceAll(payload.accounts),
    InvestmentRepository.replaceAll(payload.investments),
    InvestmentTransactionRepository.replaceAll(payload.investmentTransactions),
    TransactionRepository.replaceAll(payload.transactions),
    BudgetRepository.replaceAll(payload.budgets),
    LiabilityRepository.replaceAll(payload.liabilities),
    SettingsRepository.update(payload.settings),
  ]);

  return { success: true };
}
