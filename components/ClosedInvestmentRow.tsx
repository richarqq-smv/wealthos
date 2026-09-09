import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { Card } from "./Card";
import { MoneyText } from "./MoneyText";
import type { Investment, InvestmentTransaction } from "@/types/models";

/**
 * A fully-sold position (quantity === 0) has nothing meaningful to show via
 * the normal InvestmentCard — current value and return% are always 0, which
 * reads as "worthless," not "closed." This row shows what actually matters
 * once a position is closed: realized P&L, summed only from transactions
 * that carry a known figure (broker-reported or FIFO-fallback-calculated —
 * see features/brokerImport/fifoFallback.ts). If nothing in the history
 * carries a realized P&L (e.g. a manually zeroed-out position with no
 * import data), this says so explicitly rather than showing €0.
 */
export function ClosedInvestmentRow({ investment, transactions }: { investment: Investment; transactions: InvestmentTransaction[] }) {
  const { colors } = useTheme();
  const pnlRows = transactions.filter((t) => t.investmentId === investment.id && typeof t.realizedPnlMinor === "number");
  const hasKnownPnl = pnlRows.length > 0;
  const totalRealizedPnlMinor = pnlRows.reduce((sum, t) => sum + (t.realizedPnlMinor ?? 0), 0);

  return (
    <Card onPress={() => router.push(`/investment/${investment.id}`)} style={styles.card}>
      <View style={styles.info}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {investment.name}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{investment.ticker}</Text>
          <View style={[styles.badge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[typography.micro, { color: colors.textTertiary }]}>Gesloten</Text>
          </View>
        </View>
      </View>
      <View style={styles.trailing}>
        {hasKnownPnl ? (
          <MoneyText minor={totalRealizedPnlMinor} signed variant="medium" currency={investment.currency} />
        ) : (
          <Text style={[typography.caption, { color: colors.textTertiary }]}>Onbekend</Text>
        )}
        <Text style={[typography.micro, { color: colors.textTertiary }]}>Gerealiseerd</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  info: { flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: 100, borderWidth: StyleSheet.hairlineWidth },
  trailing: { alignItems: "flex-end", gap: 2 },
});
