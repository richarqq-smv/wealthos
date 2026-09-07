import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import {
  LIVE_STATUS_LABEL,
  MARKET_DATA_ERROR_LABEL,
  formatTimeHHMMSS,
  type LiveStatus,
} from "@/lib/marketData/liveStatus";
import type { MarketDataErrorKind } from "@/types/marketData";

interface LiveDataBadgeProps {
  status: LiveStatus;
  /** Timestamp of the last genuinely successful fetch — never shown for "live"/"delayed" unless this is set, by construction of how callers derive `status`. */
  timestamp: string | null;
  errorKind?: MarketDataErrorKind | null;
}

const STATUS_COLOR_KEY: Record<LiveStatus, "positive" | "warning" | "textTertiary" | "negative"> = {
  live: "positive",
  delayed: "warning",
  offline: "textTertiary",
  error: "negative",
};

/**
 * The single place allowed to render a "LIVE"-shaped label — `status` must
 * come from `deriveLiveStatus`/`deriveGlobalLiveStatus`, never from raw
 * cache age, so this can never show LIVE off the back of a failed refresh.
 */
export function LiveDataBadge({ status, timestamp, errorKind }: LiveDataBadgeProps) {
  const { colors } = useTheme();
  const color = colors[STATUS_COLOR_KEY[status]];

  const suffix =
    status === "error" && errorKind
      ? MARKET_DATA_ERROR_LABEL[errorKind]
      : timestamp
        ? `bijgewerkt ${formatTimeHHMMSS(timestamp)}`
        : status === "offline"
          ? "nog niet opgehaald"
          : undefined;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[typography.micro, { color }]}>
        {LIVE_STATUS_LABEL[status]}
        {suffix ? ` · ${suffix}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
