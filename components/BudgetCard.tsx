import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, typography } from "@/constants/theme";
import { TRANSACTION_CATEGORY_LABEL } from "@/constants/categories";
import { calculateBudgetUsage, type BudgetStatus } from "@/lib/calculations";
import { Card } from "./Card";
import { usePrivacyFormat } from "@/hooks/usePrivacyFormat";
import { formatPercentage } from "@/utils/money";
import type { Budget, Transaction } from "@/types/models";

const STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: "Op schema",
  warning: "Let op",
  danger: "Bijna op",
  over: "Overschreden",
};

export function BudgetCard({ budget, transactions }: { budget: Budget; transactions: Transaction[] }) {
  const { colors } = useTheme();
  const { money } = usePrivacyFormat();
  const usage = calculateBudgetUsage(budget, transactions);

  const statusColor: Record<BudgetStatus, string> = {
    ok: colors.positive,
    warning: colors.warning,
    danger: colors.warning,
    over: colors.negative,
  };

  return (
    <Card onPress={() => router.push(`/budget/${budget.id}`)}>
      <View style={styles.headerRow}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
          {TRANSACTION_CATEGORY_LABEL[budget.category]}
        </Text>
        <Text style={[typography.caption, { color: statusColor[usage.status], fontWeight: "600" }]}>
          {STATUS_LABEL[usage.status]}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, usage.percentage * 100)}%`,
              backgroundColor: statusColor[usage.status],
            },
          ]}
        />
      </View>
      <View style={styles.footerRow}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {money(usage.spentMinor)} van {money(usage.budgetMinor)}
        </Text>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>
          {formatPercentage(usage.percentage, { signed: false })}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  track: {
    height: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radius.pill },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
});
