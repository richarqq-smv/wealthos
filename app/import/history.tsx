import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { BrokerImportRepository } from "@/lib/repositories/BrokerImportRepository";
import type { BrokerImportRecord } from "@/types/models";

const BROKER_LABEL: Record<string, string> = { revolut: "Revolut", degiro: "DEGIRO" };

export default function ImportHistoryScreen() {
  const { colors } = useTheme();
  const [records, setRecords] = useState<BrokerImportRecord[] | null>(null);

  useEffect(() => {
    BrokerImportRepository.getAllSorted().then(setRecords);
  }, []);

  if (records === null) return null;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Importgeschiedenis" }} />
      {records.length === 0 ? (
        <EmptyState icon="time-outline" title="Nog geen imports" description="Zodra je een broker-import uitvoert, verschijnt die hier." />
      ) : (
        records.map((record) => (
          <Card key={record.id} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>{BROKER_LABEL[record.broker] ?? record.broker}</Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>{new Date(record.importedAt).toLocaleString("nl-NL")}</Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
              {record.rowsScanned} rijen gescand · {record.rowsImported} geïmporteerd · {record.rowsDuplicate} duplicaten
            </Text>
            <Text style={[typography.micro, { color: colors.textTertiary, marginTop: spacing.xxs }]} numberOfLines={1}>
              {record.sourceFileNames.join(", ")}
            </Text>
            {record.warnings.length > 0 ? (
              <Text style={[typography.micro, { color: colors.warning, marginTop: spacing.xxs }]}>
                {record.warnings.length} waarschuwing{record.warnings.length === 1 ? "" : "en"}
              </Text>
            ) : null}
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
