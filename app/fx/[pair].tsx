import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { FilterChips } from "@/components/FilterChips";
import { PortfolioChart } from "@/components/PortfolioChart";
import { LiveDataBadge } from "@/components/LiveDataBadge";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { MarketDataService } from "@/services/market/MarketDataService";
import { marketDataInstrumentKey } from "@/types/marketData";
import type { FxRate, HistoricalPeriod, HistoricalSeries } from "@/types/marketData";
import { useMarketDataStore } from "@/store/marketDataStore";
import { useSettingsStore } from "@/store/settingsStore";
import { deriveLiveStatus, EMPTY_REFRESH_STATUS } from "@/lib/marketData/liveStatus";

const HISTORY_PERIOD_OPTIONS: { value: HistoricalPeriod; label: string }[] = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "5D" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "1Y", label: "1J" },
  { value: "MAX", label: "MAX" },
];

/** `pair` is `"EUR-USD"` — Twelve Data itself uses `EUR/USD`, but `/` is not a valid Expo Router URL segment. */
function parsePair(pair: string): { base: string; quote: string } | null {
  const [base, quote] = pair.split("-");
  if (!base || !quote) return null;
  return { base: base.toUpperCase(), quote: quote.toUpperCase() };
}

export default function FxDetailScreen() {
  const { pair } = useLocalSearchParams<{ pair: string }>();
  const { colors } = useTheme();
  const parsed = parsePair(pair ?? "");

  const [rate, setRate] = useState<FxRate | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [period, setPeriod] = useState<HistoricalPeriod>("3M");
  const [history, setHistory] = useState<HistoricalSeries | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const instrumentKey = parsed ? marketDataInstrumentKey(`${parsed.base}/${parsed.quote}`) : "";
  const instrumentStatus = useMarketDataStore((s) => s.statusByInstrument[instrumentKey]) ?? EMPTY_REFRESH_STATUS;
  const marketDataEnabled = useSettingsStore((s) => s.marketData.enabled);
  const liveStatus = deriveLiveStatus("forex", instrumentStatus, marketDataEnabled);
  const recordInstrumentAttempt = useMarketDataStore((s) => s.recordInstrumentAttempt);
  const recordInstrumentResult = useMarketDataStore((s) => s.recordInstrumentResult);

  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    setIsLoadingRate(true);
    recordInstrumentAttempt(instrumentKey);
    MarketDataService.getFxRate(parsed.base, parsed.quote)
      .then((result) => {
        if (cancelled) return;
        setRate(result);
        recordInstrumentResult(
          instrumentKey,
          result ? { success: true } : { success: false, error: "providerUnavailable" }
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRate(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentKey]);

  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    setIsLoadingHistory(true);
    setHistoryError(null);
    MarketDataService.getHistoricalForSymbol(`${parsed.base}/${parsed.quote}`, "forex", period)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setHistory(result.series);
        } else {
          setHistory(null);
          if (result.reason !== "noApiKey") {
            setHistoryError(
              result.reason === "rateLimited" ? "Limiet bereikt, probeer later opnieuw." : "Kon historische koersdata niet ophalen."
            );
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentKey, period]);

  if (!parsed) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Wisselkoers" }} />
        <Text style={[typography.body, { color: colors.textSecondary, padding: spacing.md }]}>
          Ongeldig valutapaar.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: `${parsed.base}/${parsed.quote}` }} />

      <Card style={styles.headerCard}>
        <View style={styles.badgeRow}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            {parsed.base}/{parsed.quote}
          </Text>
          <LiveDataBadge status={liveStatus} timestamp={instrumentStatus.lastSuccessAt} errorKind={instrumentStatus.lastErrorKind} />
        </View>
        {isLoadingRate && !rate ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.sm }} />
        ) : rate ? (
          <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            {rate.rate.toFixed(4)}
          </Text>
        ) : (
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
            Kon geen wisselkoers ophalen.
          </Text>
        )}
      </Card>

      <Card style={styles.section}>
        <View style={styles.periodRow}>
          <FilterChips options={HISTORY_PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </View>
        {isLoadingHistory ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
        ) : historyError ? (
          <Text style={[typography.caption, { color: colors.negative, paddingVertical: spacing.md }]}>{historyError}</Text>
        ) : history && history.points.length > 1 ? (
          <PortfolioChart
            points={history.points.map((p) => ({ date: p.date, valueMinor: p.closeMinor }))}
            showAxisLabels
          />
        ) : (
          <Text style={[typography.caption, { color: colors.textTertiary, paddingVertical: spacing.md }]}>
            Geen historische koersdata beschikbaar.
          </Text>
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: { marginBottom: spacing.md },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { marginBottom: spacing.md },
  periodRow: { marginBottom: spacing.sm },
});
