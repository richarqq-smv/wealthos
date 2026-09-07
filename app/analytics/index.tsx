import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { MoneyText } from "@/components/MoneyText";
import { AllocationChart } from "@/components/AllocationChart";
import { PortfolioChart } from "@/components/PortfolioChart";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useTransactionsStore } from "@/store/transactionsStore";
import { useWealthSummary } from "@/hooks/useWealthSummary";
import { usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots";
import { TRANSACTION_CATEGORY_LABEL } from "@/constants/categories";
import {
  calculateMonthlyExpenses,
  calculateMonthlyIncome,
  calculateNetCashflow,
  calculateSavingsRate,
  type AllocationSlice,
} from "@/lib/calculations";
import { formatPercentage } from "@/utils/money";
import { monthKey, previousMonthKey } from "@/utils/date";
import type { TransactionCategory } from "@/types/models";

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const transactions = useTransactionsStore((s) => s.transactions);
  const { netWorthMinor } = useWealthSummary();
  const { snapshots } = usePortfolioSnapshots();

  const thisMonth = monthKey();
  const lastMonth = previousMonthKey(thisMonth);

  const income = calculateMonthlyIncome(transactions, thisMonth);
  const expenses = calculateMonthlyExpenses(transactions, thisMonth);
  const netCashflow = calculateNetCashflow(income, expenses);
  const savingsRate = calculateSavingsRate(income, expenses);

  const incomeLastMonth = calculateMonthlyIncome(transactions, lastMonth);
  const expensesLastMonth = calculateMonthlyExpenses(transactions, lastMonth);

  const expenseAllocation: AllocationSlice[] = useMemo(() => {
    const buckets = new Map<TransactionCategory, number>();
    for (const t of transactions) {
      if (t.type !== "expense" || t.date.slice(0, 7) !== thisMonth) continue;
      buckets.set(t.category, (buckets.get(t.category) ?? 0) + t.amountMinor);
    }
    const total = Array.from(buckets.values()).reduce((sum, v) => sum + v, 0);
    return Array.from(buckets.entries())
      .map(([category, valueMinor]) => ({
        key: category,
        label: TRANSACTION_CATEGORY_LABEL[category],
        valueMinor,
        percentage: total === 0 ? 0 : valueMinor / total,
      }))
      .sort((a, b) => b.valueMinor - a.valueMinor);
  }, [transactions, thisMonth]);

  const chartPoints = snapshots.map((s) => ({ date: s.date, valueMinor: s.netWorthMinor }));
  if (chartPoints.length > 0) {
    chartPoints[chartPoints.length - 1] = { date: new Date().toISOString(), valueMinor: netWorthMinor };
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Analyse" }} />

      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Vermogen</Text>
        <PortfolioChart points={chartPoints} />
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Inkomsten deze maand</Text>
          <MoneyText minor={income} variant="medium" style={{ marginTop: spacing.xxs }} />
        </Card>
        <Card style={styles.statCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Uitgaven deze maand</Text>
          <MoneyText minor={expenses} variant="medium" style={{ marginTop: spacing.xxs }} />
        </Card>
      </View>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Netto cashflow</Text>
          <MoneyText minor={netCashflow} signed variant="medium" style={{ marginTop: spacing.xxs }} />
        </Card>
        <Card style={styles.statCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Spaarpercentage</Text>
          <Text style={[typography.numericMedium, { color: colors.textPrimary, marginTop: spacing.xxs }]}>
            {formatPercentage(savingsRate, { signed: false })}
          </Text>
        </Card>
      </View>

      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Uitgavenanalyse</Text>
        {expenseAllocation.length === 0 ? (
          <Text style={[typography.body, { color: colors.textTertiary }]}>
            Nog geen uitgaven deze maand.
          </Text>
        ) : (
          <AllocationChart slices={expenseAllocation} />
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Deze maand vs. vorige maand
        </Text>
        <ComparisonRow label="Inkomsten" current={income} previous={incomeLastMonth} />
        <ComparisonRow label="Uitgaven" current={expenses} previous={expensesLastMonth} />
        <ComparisonRow
          label="Netto cashflow"
          current={netCashflow}
          previous={calculateNetCashflow(incomeLastMonth, expensesLastMonth)}
          last
        />
      </Card>
    </ScreenContainer>
  );
}

function ComparisonRow({
  label,
  current,
  previous,
  last = false,
}: {
  label: string;
  current: number;
  previous: number;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.comparisonRow,
        !last && { borderBottomColor: colors.border, borderBottomWidth: 0.5 },
      ]}
    >
      <Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.comparisonValues}>
        <MoneyText minor={current} variant="body" />
        <Text style={[typography.caption, { color: colors.textTertiary }]}>
          vorige maand: <MoneyText minor={previous} variant="body" style={{ color: colors.textTertiary }} />
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  statCard: { flex: 1 },
  comparisonRow: { paddingVertical: spacing.sm },
  comparisonValues: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xxs },
});
