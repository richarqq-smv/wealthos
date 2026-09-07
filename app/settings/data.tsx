import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { InfoModal } from "@/components/InfoModal";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { exportDataToFile } from "@/features/importExport/exportData";
import { importDataFromFile } from "@/features/importExport/importData";
import { seedDemoData, clearFinancialData } from "@/features/demoData/seed";
import { refreshAllFinancialData } from "@/store";
import { useSettingsStore } from "@/store/settingsStore";

export default function DataScreen() {
  const { colors } = useTheme();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [info, setInfo] = useState<{ title: string; message?: string } | null>(null);

  const handleExport = async () => {
    setBusy("export");
    try {
      await exportDataToFile();
    } catch {
      setInfo({ title: "Export mislukt", message: "Er ging iets mis. Probeer het opnieuw." });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    setBusy("import");
    try {
      const result = await importDataFromFile();
      if (result.success) {
        await refreshAllFinancialData();
        setInfo({ title: "Import gelukt", message: "Je gegevens zijn geïmporteerd." });
      } else if (result.reason === "invalid") {
        setInfo({ title: "Dit bestand kan niet worden geïmporteerd." });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    setBusy("reset");
    try {
      await clearFinancialData();
      await seedDemoData();
      await completeOnboarding(true);
      await refreshAllFinancialData();
    } finally {
      setBusy(null);
      setConfirmReset(false);
    }
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Data" }} />

      <Card padded={false} style={styles.card}>
        <Row icon="share-outline" label="Exporteren" onPress={handleExport} loading={busy === "export"} />
        <Row icon="download-outline" label="Importeren" onPress={handleImport} loading={busy === "import"} last />
      </Card>

      <Card padded={false} style={styles.card}>
        <Row
          icon="refresh-outline"
          label="Demo-data opnieuw instellen"
          onPress={() => setConfirmReset(true)}
          loading={busy === "reset"}
          last
          destructive
        />
      </Card>

      <ConfirmationModal
        visible={confirmReset}
        title="Demo-data opnieuw instellen?"
        message="Hiermee worden je lokale wijzigingen verwijderd en wordt de voorbeeldsituatie teruggezet."
        confirmLabel="Resetten"
        destructive
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />

      <InfoModal
        visible={info !== null}
        title={info?.title ?? ""}
        message={info?.message}
        onDismiss={() => setInfo(null)}
      />
    </ScreenContainer>
  );
}

function Row({
  icon,
  label,
  onPress,
  loading,
  last = false,
  destructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading: boolean;
  last?: boolean;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        { opacity: pressed || loading ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={destructive ? colors.negative : colors.textSecondary} />
      <Text style={[typography.body, { color: destructive ? colors.negative : colors.textPrimary, flex: 1 }]}>
        {label}
      </Text>
      {loading ? <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
  },
});
