import { useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { TextField } from "@/components/form/TextField";
import { PickerField } from "@/components/form/PickerField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { useMarketDataStore } from "@/store/marketDataStore";
import { MarketDataService } from "@/services/market/MarketDataService";
import { getSecureKey } from "@/lib/secureKeyStore";
import { API_KEY_STORAGE } from "@/lib/marketData/constants";
import type { MarketDataAssetToggles } from "@/types/models";
import type { MarketDataProviderId } from "@/types/marketData";

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>{title}</Text>
      <Card padded>
        {children}
        {subtitle ? (
          <Text style={[typography.micro, { color: colors.textTertiary, marginTop: spacing.sm }]}>{subtitle}</Text>
        ) : null}
      </Card>
    </View>
  );
}

const ASSET_TOGGLE_LABELS: Array<{ key: keyof MarketDataAssetToggles; label: string }> = [
  { key: "stocks", label: "Aandelen" },
  { key: "etf", label: "ETF's" },
  { key: "crypto", label: "Crypto" },
  { key: "forex", label: "Valuta (FX)" },
  { key: "historical", label: "Historische koersen" },
  { key: "dividend", label: "Dividendgegevens" },
  { key: "companyInfo", label: "Bedrijfsinformatie" },
];

const REFRESH_INTERVAL_OPTIONS = [
  { value: "5", label: "Elke 5 minuten" },
  { value: "10", label: "Elke 10 minuten" },
  { value: "15", label: "Elke 15 minuten" },
  { value: "30", label: "Elke 30 minuten" },
  { value: "60", label: "Elk uur" },
];

interface ProviderCardProps {
  providerId: MarketDataProviderId;
  title: string;
  description: string;
  configured: boolean;
  onSave: (apiKey: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

function ProviderCard({ providerId, title, description, configured, onSave, onRemove }: ProviderCardProps) {
  const { colors } = useTheme();
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const keyToTest = apiKey.trim() || (await getSecureKey(API_KEY_STORAGE[providerId])) || "";
      if (!keyToTest) {
        setTestResult({ ok: false, message: "Vul eerst een API-key in." });
        return;
      }
      const result = await MarketDataService.testConnection(providerId, keyToTest);
      setTestResult(
        result.ok ? { ok: true, message: "Verbinding gelukt." } : { ok: false, message: result.message }
      );
    } catch {
      setTestResult({ ok: false, message: "Onbekende fout bij testen." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    try {
      await onSave(apiKey.trim());
      setApiKey("");
      setTestResult({ ok: true, message: "API-key opgeslagen." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard title={title} subtitle={description}>
      <View style={styles.providerHeader}>
        <Ionicons
          name={configured ? "checkmark-circle" : "ellipse-outline"}
          size={18}
          color={configured ? colors.positive : colors.textTertiary}
        />
        <Text style={[typography.caption, { color: configured ? colors.positive : colors.textTertiary }]}>
          {configured ? "Gekoppeld" : "Niet gekoppeld"}
        </Text>
      </View>

      <TextField
        label="API-key"
        value={apiKey}
        onChangeText={setApiKey}
        placeholder={configured ? "•••••••••••••••••••• (nieuwe key om te wijzigen)" : "Plak hier je gratis API-key"}
        secureTextEntry
        autoCapitalize="none"
      />

      {testResult ? (
        <Text
          style={[
            typography.caption,
            { color: testResult.ok ? colors.positive : colors.negative, marginTop: spacing.xs },
          ]}
        >
          {testResult.message}
        </Text>
      ) : null}

      <View style={styles.buttonRow}>
        <View style={styles.buttonHalf}>
          <SecondaryButton label={isTesting ? "Bezig..." : "Verbinding testen"} onPress={handleTest} disabled={isTesting} />
        </View>
        <View style={styles.buttonHalf}>
          <PrimaryButton
            label={isSaving ? "Bezig..." : "Opslaan"}
            onPress={handleSave}
            disabled={isSaving || !apiKey.trim()}
          />
        </View>
      </View>

      {configured ? (
        <View style={{ marginTop: spacing.sm }}>
          <SecondaryButton label="API-key verwijderen" onPress={() => setConfirmRemove(true)} />
        </View>
      ) : null}

      <ConfirmationModal
        visible={confirmRemove}
        title="API-key verwijderen"
        message={`Weet je zeker dat je de ${title}-key wilt verwijderen? Live data van deze bron stopt direct.`}
        confirmLabel="Verwijderen"
        destructive
        onConfirm={async () => {
          setConfirmRemove(false);
          await onRemove();
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </SectionCard>
  );
}

export default function MarketDataSettingsScreen() {
  const { colors } = useTheme();
  const marketData = useSettingsStore((s) => s.marketData);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const removeApiKey = useSettingsStore((s) => s.removeApiKey);
  const setMarketDataEnabled = useSettingsStore((s) => s.setMarketDataEnabled);
  const setAssetToggle = useSettingsStore((s) => s.setAssetToggle);
  const setAutoRefresh = useSettingsStore((s) => s.setAutoRefresh);
  const setRefreshIntervalMinutes = useSettingsStore((s) => s.setRefreshIntervalMinutes);
  const markMarketDataUpdated = useSettingsStore((s) => s.markMarketDataUpdated);
  const investments = useInvestmentsStore((s) => s.investments);
  const refreshAll = useMarketDataStore((s) => s.refreshAll);
  const isRefreshing = useMarketDataStore((s) => s.isRefreshing);
  const lastError = useMarketDataStore((s) => s.lastError);

  const lastUpdateLabel = marketData.lastSuccessfulUpdate
    ? new Date(marketData.lastSuccessfulUpdate).toLocaleString("nl-NL")
    : "Nog niet vernieuwd";

  const handleRefreshNow = async () => {
    const { hadSuccess } = await refreshAll(investments);
    if (hadSuccess) await markMarketDataUpdated();
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Live marktdata" }} />

      <SectionCard
        title="Live marktdata"
        subtitle="Optioneel en gratis. Koersen komen rechtstreeks van jouw eigen, gratis API-key naar dit apparaat — WealthOS heeft geen eigen server en stuurt niets door."
      >
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>Live marktdata inschakelen</Text>
          <Switch value={marketData.enabled} onValueChange={setMarketDataEnabled} trackColor={{ true: colors.accent }} />
        </View>
      </SectionCard>

      {marketData.enabled ? (
        <>
          <ProviderCard
            providerId="twelveData"
            title="Twelve Data (primaire bron)"
            description="Voor koersen, historische koersen en valutakoersen. Gratis account op twelvedata.com."
            configured={marketData.twelveDataConfigured}
            onSave={(key) => setApiKey("twelveData", key)}
            onRemove={() => removeApiKey("twelveData")}
          />

          <ProviderCard
            providerId="alphaVantage"
            title="Alpha Vantage (optioneel)"
            description="Alleen voor dividend- en bedrijfsinformatie. Gratis account op alphavantage.co."
            configured={marketData.alphaVantageConfigured}
            onSave={(key) => setApiKey("alphaVantage", key)}
            onRemove={() => removeApiKey("alphaVantage")}
          />

          <SectionCard title="Databronnen">
            {ASSET_TOGGLE_LABELS.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.row,
                  { justifyContent: "space-between" },
                  index > 0 && { marginTop: spacing.sm },
                ]}
              >
                <Text style={[typography.body, { color: colors.textPrimary }]}>{item.label}</Text>
                <Switch
                  value={marketData.assetToggles[item.key]}
                  onValueChange={(value) => setAssetToggle(item.key, value)}
                  trackColor={{ true: colors.accent }}
                />
              </View>
            ))}
          </SectionCard>

          <SectionCard title="Verversen">
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={[typography.body, { color: colors.textPrimary }]}>Automatisch verversen</Text>
              <Switch value={marketData.autoRefresh} onValueChange={setAutoRefresh} trackColor={{ true: colors.accent }} />
            </View>

            {marketData.autoRefresh ? (
              <View style={{ marginTop: spacing.sm }}>
                <PickerField
                  label="Verversingsinterval"
                  value={String(marketData.refreshIntervalMinutes)}
                  options={REFRESH_INTERVAL_OPTIONS}
                  onChange={(value) => setRefreshIntervalMinutes(Number(value))}
                />
              </View>
            ) : null}

            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              Laatst bijgewerkt: {lastUpdateLabel}
            </Text>
            {lastError ? (
              <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xxs }]}>
                Kon niet volledig verversen — laatst bekende koersen worden getoond.
              </Text>
            ) : null}

            <View style={{ marginTop: spacing.sm }}>
              {isRefreshing ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <SecondaryButton label="Nu vernieuwen" onPress={handleRefreshNow} />
              )}
            </View>
          </SectionCard>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center" },
  providerHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  buttonHalf: { flex: 1 },
});
