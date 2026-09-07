import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";

interface LiveDataBadgeProps {
  priceUpdatedAt?: string | null;
  /** Minutes after which the badge switches from "live" to "cached" styling. Defaults to 30. */
  freshAfterMinutes?: number;
}

/** Subtle status indicator for a live-data-linked position — never shown for manual-only positions. */
export function LiveDataBadge({ priceUpdatedAt, freshAfterMinutes = 30 }: LiveDataBadgeProps) {
  const { colors } = useTheme();

  if (!priceUpdatedAt) {
    return (
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: colors.textTertiary }]} />
        <Text style={[typography.micro, { color: colors.textTertiary }]}>Live · nog niet opgehaald</Text>
      </View>
    );
  }

  const ageMinutes = (Date.now() - new Date(priceUpdatedAt).getTime()) / 60000;
  const isFresh = ageMinutes >= 0 && ageMinutes <= freshAfterMinutes;
  const time = new Date(priceUpdatedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: isFresh ? colors.positive : colors.textTertiary }]} />
      <Text style={[typography.micro, { color: isFresh ? colors.positive : colors.textTertiary }]}>
        {isFresh ? `Live · bijgewerkt ${time}` : `Cache · bijgewerkt ${time}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
