import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { spacing, radius, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { useMarketDataStore } from "@/store/marketDataStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import {
  deriveGlobalLiveStatus,
  LIVE_STATUS_LABEL,
  MARKET_DATA_ERROR_LABEL,
  formatTimeHHMMSS,
} from "@/lib/marketData/liveStatus";

const STATUS_COLOR_KEY = {
  live: "positive",
  delayed: "warning",
  offline: "textTertiary",
  error: "negative",
} as const;

/** Rounds up so the countdown never flashes "0s" for a moment before the next tick actually fires. */
function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

/**
 * The single place a user can see, at a glance, whether market data is
 * genuinely refreshing — not tucked away in Settings. Lives at the top of
 * the Investments/Portfolio overview per the "doesn't feel live" complaint:
 * a real LIVE/VERTRAAGD/OFFLINE/FOUT status, a real HH:MM:SS timestamp, a
 * live countdown to the next automatic tick, and a manual refresh that
 * genuinely re-calls the provider (see MarketDataService.refreshQuotes).
 */
export function MarketDataStatusBar() {
  const { colors } = useTheme();
  const marketData = useSettingsStore((s) => s.marketData);
  const markMarketDataUpdated = useSettingsStore((s) => s.markMarketDataUpdated);
  const investments = useInvestmentsStore((s) => s.investments);
  const isRefreshing = useMarketDataStore((s) => s.isRefreshing);
  const lastError = useMarketDataStore((s) => s.lastError);
  const nextRefreshAt = useMarketDataStore((s) => s.nextRefreshAt);
  const refreshAll = useMarketDataStore((s) => s.refreshAll);

  const [countdown, setCountdown] = useState(() => (nextRefreshAt ? secondsUntil(nextRefreshAt) : null));

  useEffect(() => {
    if (!nextRefreshAt) {
      setCountdown(null);
      return;
    }
    setCountdown(secondsUntil(nextRefreshAt));
    const id = setInterval(() => setCountdown(secondsUntil(nextRefreshAt)), 1000);
    return () => clearInterval(id);
  }, [nextRefreshAt]);

  if (!marketData.enabled) return null;

  const hasTrackedInvestments = investments.some((i) => i.liveDataEnabled && i.providerSymbol);
  const status = deriveGlobalLiveStatus({
    enabled: marketData.enabled,
    hasApiKey: marketData.twelveDataConfigured,
    lastSuccessfulUpdate: marketData.lastSuccessfulUpdate,
    lastError,
  });
  const color = colors[STATUS_COLOR_KEY[status]];

  const handleRefresh = async () => {
    const { hadSuccess } = await refreshAll(investments);
    if (hadSuccess) await markMarketDataUpdated();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View>
          <Text style={[typography.caption, { color, fontWeight: "600" }]}>
            {LIVE_STATUS_LABEL[status]}
            {status === "error" && lastError ? ` · ${MARKET_DATA_ERROR_LABEL[lastError]}` : ""}
          </Text>
          <Text style={[typography.micro, { color: colors.textTertiary }]}>
            {marketData.lastSuccessfulUpdate
              ? `Laatst bijgewerkt: ${formatTimeHHMMSS(marketData.lastSuccessfulUpdate)}`
              : "Nog niet bijgewerkt"}
            {marketData.autoRefresh && countdown !== null && !isRefreshing
              ? ` · volgende update over ${countdown}s`
              : ""}
          </Text>
          {!hasTrackedInvestments ? (
            <Pressable onPress={() => router.push("/settings/marketData")} accessibilityRole="button">
              <Text style={[typography.micro, { color: colors.accent, marginTop: 2 }]}>
                Koppel een belegging aan live data →
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {isRefreshing ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <Pressable
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Nu vernieuwen"
          style={({ pressed }) => [styles.refreshButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="refresh" size={16} color={colors.textPrimary} />
          <Text style={[typography.caption, { color: colors.textPrimary }]}>Nu vernieuwen</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  refreshButton: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, paddingLeft: spacing.sm },
});
