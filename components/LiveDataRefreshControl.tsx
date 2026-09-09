import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { LiveDataBadge } from "@/components/LiveDataBadge";
import { useMarketDataStore } from "@/store/marketDataStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { getQuotaStatus, type QuotaStatus } from "@/lib/marketData/requestQuota";
import type { LiveStatus } from "@/lib/marketData/liveStatus";
import type { MarketDataErrorKind } from "@/types/marketData";

interface LiveDataRefreshControlProps {
  status: LiveStatus;
  timestamp: string | null;
  errorKind?: MarketDataErrorKind | null;
}

/**
 * Compact refresh control for the dashboard: the existing `LiveDataBadge`
 * plus a small round refresh button and a one-line quota estimate — all one
 * visual unit, no modal. This is a NEW surface (the dashboard previously only
 * showed the read-only badge), but it triggers the exact same
 * `useMarketDataStore().refreshAll` the Investments-tab `MarketDataStatusBar`
 * already uses — one refresh code path, two screens.
 */
export function LiveDataRefreshControl({ status, timestamp, errorKind }: LiveDataRefreshControlProps) {
  const { colors } = useTheme();
  const investments = useInvestmentsStore((s) => s.investments);
  const isRefreshing = useMarketDataStore((s) => s.isRefreshing);
  const refreshAll = useMarketDataStore((s) => s.refreshAll);
  const markMarketDataUpdated = useSettingsStore((s) => s.markMarketDataUpdated);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    getQuotaStatus().then((q) => {
      if (!cancelled) setQuota(q);
    });
    return () => {
      cancelled = true;
    };
    // Re-read after every refresh attempt (isRefreshing flips false→true→false) so the count reflects reality, never a client-only countdown.
  }, [isRefreshing]);

  const handleRefresh = async () => {
    const { hadSuccess } = await refreshAll(investments);
    if (hadSuccess) await markMarketDataUpdated();
  };

  const disabled = isRefreshing || quota?.exhausted === true;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <LiveDataBadge status={status} timestamp={timestamp} errorKind={errorKind} />
        {isRefreshing ? (
          <ActivityIndicator size="small" color={colors.accent} style={styles.button} />
        ) : (
          <Pressable
            onPress={handleRefresh}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Marktdata verversen"
            style={({ pressed }) => [
              styles.button,
              { borderColor: colors.border, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={13} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>
      {quota ? (
        <Text style={[typography.micro, { color: colors.textTertiary, marginTop: 2 }]}>
          {quota.exhausted
            ? "Gratis daglimiet bereikt — morgen weer beschikbaar"
            : `~${quota.requestsRemaining} gratis verversingen over vandaag`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "flex-end" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  button: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
