import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { InfoModal } from "@/components/InfoModal";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { pickBrokerFiles } from "@/features/brokerImport/pickBrokerFiles";
import { buildImportPreview, type ImportPreviewResult } from "@/features/brokerImport/engine";
import { confirmImport } from "@/features/brokerImport/confirmImport";

export default function RevolutImportScreen() {
  const { colors } = useTheme();
  const investments = useInvestmentsStore((s) => s.investments);
  const refreshInvestments = useInvestmentsStore((s) => s.refresh);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const handlePickFiles = async () => {
    setError(null);
    setBusy(true);
    try {
      const picked = await pickBrokerFiles();
      if (!picked.ok) {
        if (picked.reason === "read-error") setError("Kan een of meer bestanden niet lezen. Probeer het opnieuw.");
        return;
      }
      const result = await buildImportPreview("revolut", picked.files, investments);
      if (result.counts.totalScanned === 0) {
        setError(
          "Geen bruikbare transacties gevonden. Controleer of je het Rekeningoverzicht (CSV of Excel) en/of de Winst- & verliesrekening (PDF) hebt geselecteerd — zie het stappenplan."
        );
        return;
      }
      setPreview(result);
    } catch {
      setError("Er ging iets mis bij het verwerken van deze bestanden.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await confirmImport(preview, investments);
      await refreshInvestments();
      setDoneMessage(
        `${result.transactionsCreated} transacties geïmporteerd (${result.investmentsCreated} nieuwe beleggingen, ${result.investmentsUpdated} bijgewerkt).`
      );
      setPreview(null);
    } catch {
      setError("Bevestigen van de import is mislukt. Controleer de importgeschiedenis en probeer het zo nodig opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Revolut importeren" }} />

      {!preview ? (
        <View>
          <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Selecteer je Revolut-exportbestanden: het Rekeningoverzicht (CSV of Excel) en de Winst- & verliesrekening (PDF). WealthOS logt
            nooit in bij Revolut — alles gebeurt lokaal op dit apparaat.
          </Text>
          <SecondaryButton label="Hoe download ik deze bestanden?" onPress={() => router.push("/guides/revolut" as Href)} />
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="Bestanden kiezen" onPress={handlePickFiles} loading={busy} />
          </View>
        </View>
      ) : (
        <View>
          <Card style={styles.summaryCard}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>{preview.counts.totalScanned} transacties gevonden</Text>
            <View style={styles.countsGrid}>
              <CountTile label="Nieuw" value={preview.counts.new} color={colors.positive} />
              <CountTile label="Al geïmporteerd" value={preview.counts.duplicate} color={colors.textTertiary} />
              <CountTile label="Koop" value={preview.counts.buy} color={colors.textPrimary} />
              <CountTile label="Verkoop" value={preview.counts.sell} color={colors.textPrimary} />
              <CountTile label="Dividend" value={preview.counts.dividend} color={colors.textPrimary} />
              <CountTile label="Corporate actions" value={preview.counts.correctiveAction} color={colors.textPrimary} />
            </View>
          </Card>

          {preview.warnings.length > 0 ? (
            <Card style={styles.warningsCard}>
              <View style={styles.headerRow}>
                <Ionicons name="warning-outline" size={18} color={colors.warning} />
                <Text style={[typography.h3, { color: colors.textPrimary }]}>Waarschuwingen ({preview.warnings.length})</Text>
              </View>
              {preview.warnings.slice(0, 20).map((warning, index) => (
                <Text key={index} style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
                  • {warning.message}
                </Text>
              ))}
              {preview.warnings.length > 20 ? (
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xxs }]}>
                  + {preview.warnings.length - 20} meer
                </Text>
              ) : null}
            </Card>
          ) : null}

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Annuleren" onPress={() => setPreview(null)} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label={`Importeren (${preview.counts.new})`} onPress={handleConfirm} loading={busy} disabled={preview.counts.new === 0} />
            </View>
          </View>
        </View>
      )}

      <InfoModal visible={!!error} title="Import mislukt" message={error ?? undefined} onDismiss={() => setError(null)} />
      <InfoModal
        visible={!!doneMessage}
        title="Import gelukt"
        message={doneMessage ?? undefined}
        onDismiss={() => {
          setDoneMessage(null);
          router.back();
        }}
      />
    </ScreenContainer>
  );
}

function CountTile({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.countTile}>
      <Text style={[typography.h2, { color }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: { marginBottom: spacing.md },
  warningsCard: { marginBottom: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xxs },
  countsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  countTile: { minWidth: 80 },
  actions: { flexDirection: "row", gap: spacing.sm },
});
