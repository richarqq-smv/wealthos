import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { PickerField } from "@/components/form/PickerField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { EmptyState } from "@/components/EmptyState";
import { InfoModal } from "@/components/InfoModal";
import { MoneyText } from "@/components/MoneyText";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useAccountsStore } from "@/store/accountsStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { pickRevolutCsvFile } from "@/features/revolutImport/pickRevolutCsvFile";
import { parseRevolutCsv, revolutRowFingerprint, type ParsedRevolutRow } from "@/features/revolutImport/parseRevolutCsv";
import { formatDateShort } from "@/utils/date";

interface PreviewRow extends ParsedRevolutRow {
  duplicate: boolean;
}

export default function ImportTransactionsScreen() {
  const { colors } = useTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const existingTransactions = useTransactionsStore((s) => s.transactions);
  const addTransaction = useTransactionsStore((s) => s.addTransaction);

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [skippedRowCount, setSkippedRowCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);

  if (accounts.length === 0) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Transacties importeren" }} />
        <EmptyState
          icon="wallet-outline"
          title="Voeg eerst een rekening toe"
          description="Geïmporteerde transacties horen bij een rekening. Maak eerst een rekening aan."
          actionLabel="Rekening toevoegen"
          onAction={() => router.push("/account/add")}
        />
      </ScreenContainer>
    );
  }

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const importableCount = preview?.filter((r) => !r.duplicate).length ?? 0;
  const duplicateCount = preview?.filter((r) => r.duplicate).length ?? 0;

  const handlePickFile = async () => {
    setError(null);
    setPreview(null);
    const picked = await pickRevolutCsvFile();
    if (!picked.ok) {
      if (picked.reason === "read-error") {
        setError("Kan dit bestand niet lezen. Probeer het opnieuw.");
      }
      return;
    }

    const result = parseRevolutCsv(picked.text);
    if (!result.ok) {
      setError(
        "Dit CSV-bestand wordt niet herkend. Controleer of het een Revolut-export is met kolommen als Date, Description en Amount."
      );
      return;
    }
    if (result.rows.length === 0) {
      setError("Geen bruikbare transacties gevonden in dit bestand.");
      return;
    }

    const existingFingerprints = new Set(
      existingTransactions
        .filter((t) => t.accountId === accountId)
        .map((t) => revolutRowFingerprint({ date: t.date, amountMinor: t.amountMinor, description: t.description }))
    );

    setFileName(picked.fileName);
    setSkippedRowCount(result.skippedRowCount);
    setPreview(
      result.rows.map((row) => ({
        ...row,
        duplicate: existingFingerprints.has(revolutRowFingerprint(row)),
      }))
    );
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setFileName(null);
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      let imported = 0;
      for (const row of preview) {
        if (row.duplicate) continue;
        await addTransaction({
          type: row.amountMinor < 0 ? "expense" : "income",
          amountMinor: Math.abs(row.amountMinor),
          description: row.description,
          category: "overig",
          accountId,
          date: row.date,
          note: "Geïmporteerd uit Revolut CSV",
        });
        imported++;
      }
      setDoneCount(imported);
      setPreview(null);
      setFileName(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Transacties importeren" }} />

      {!preview ? (
        <View>
          <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Importeer transacties uit een CSV-bestand dat je zelf hebt geëxporteerd uit Revolut (Revolut app →
            Rekening → Statement → CSV). WealthOS logt nooit in bij Revolut en vraagt nooit om je Revolut-gegevens.
          </Text>

          <PickerField label="Importeren naar rekening" value={accountId} options={accountOptions} onChange={setAccountId} />

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="CSV-bestand kiezen" onPress={handlePickFile} />
          </View>
        </View>
      ) : (
        <View>
          <Card style={styles.summaryCard}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>{fileName}</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
              {preview.length} transacties gevonden
              {duplicateCount > 0 ? `, ${duplicateCount} al eerder geïmporteerd (worden overgeslagen)` : ""}
              {skippedRowCount > 0 ? `, ${skippedRowCount} regels niet leesbaar overgeslagen` : ""}.
            </Text>
          </Card>

          <Card padded={false} style={styles.previewCard}>
            {preview.slice(0, 50).map((row, index) => (
              <View
                key={`${row.date}-${index}`}
                style={[
                  styles.previewRow,
                  index < preview.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                  row.duplicate && { opacity: 0.4 },
                ]}
              >
                <Text style={[typography.caption, { color: colors.textSecondary, width: 80 }]}>
                  {formatDateShort(row.date)}
                </Text>
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                  {row.description}
                </Text>
                <MoneyText minor={row.amountMinor} signed variant="body" />
              </View>
            ))}
            {preview.length > 50 ? (
              <Text style={[typography.caption, { color: colors.textTertiary, padding: spacing.md }]}>
                + {preview.length - 50} meer
              </Text>
            ) : null}
          </Card>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Annuleren" onPress={handleCancelPreview} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={`Importeren (${importableCount})`}
                onPress={handleConfirmImport}
                loading={busy}
                disabled={importableCount === 0}
              />
            </View>
          </View>
        </View>
      )}

      <InfoModal visible={!!error} title="Import mislukt" message={error ?? undefined} onDismiss={() => setError(null)} />
      <InfoModal
        visible={doneCount !== null}
        title="Import gelukt"
        message={`${doneCount} transacties toegevoegd.`}
        onDismiss={() => {
          setDoneCount(null);
          router.back();
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: { marginBottom: spacing.md },
  previewCard: { marginBottom: spacing.lg },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: { flexDirection: "row", gap: spacing.sm },
});
