import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { BudgetCard } from "@/components/BudgetCard";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { spacing } from "@/constants/theme";
import { useBudgetsStore } from "@/store/budgetsStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { monthKey } from "@/utils/date";

export default function BudgetScreen() {
  const budgets = useBudgetsStore((s) => s.budgets);
  const transactions = useTransactionsStore((s) => s.transactions);
  const currentMonth = monthKey();

  const monthBudgets = useMemo(() => budgets.filter((b) => b.month === currentMonth), [budgets, currentMonth]);

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Budgetten",
          headerRight: () => (
            <IconButton name="add-circle-outline" onPress={() => router.push("/budget/add")} accessibilityLabel="Budget toevoegen" />
          ),
        }}
      />

      {monthBudgets.length === 0 ? (
        <EmptyState
          icon="pie-chart-outline"
          title="Nog geen budgetten"
          description="Stel een maandbudget in per categorie om je uitgaven in de gaten te houden."
          actionLabel="Budget toevoegen"
          onAction={() => router.push("/budget/add")}
        />
      ) : (
        <View style={styles.list}>
          {monthBudgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} transactions={transactions} />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingTop: spacing.md },
});
