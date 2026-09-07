import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { spacing } from "@/constants/theme";
import { EXPENSE_CATEGORIES, TRANSACTION_CATEGORY_LABEL } from "@/constants/categories";
import { useBudgetsStore } from "@/store/budgetsStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { BudgetCard } from "@/components/BudgetCard";
import type { TransactionCategory } from "@/types/models";

const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((value) => ({ value, label: TRANSACTION_CATEGORY_LABEL[value] }));

export default function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const budgets = useBudgetsStore((s) => s.budgets);
  const editBudget = useBudgetsStore((s) => s.editBudget);
  const removeBudget = useBudgetsStore((s) => s.removeBudget);
  const transactions = useTransactionsStore((s) => s.transactions);

  const budget = budgets.find((b) => b.id === id);
  const [category, setCategory] = useState<TransactionCategory>(budget?.category ?? "overig");
  const [amount, setAmount] = useState(budget ? String(budget.amountMinor / 100).replace(".", ",") : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!budget) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Budget" }} />
        <EmptyState icon="alert-circle-outline" title="Budget niet gevonden" description="Dit budget bestaat niet meer." />
      </ScreenContainer>
    );
  }

  const save = async () => {
    await editBudget(budget.id, { category, amountMinor: parseMoneyInputToMinor(amount || "0") });
    router.back();
  };

  const handleDelete = async () => {
    await removeBudget(budget.id);
    setConfirmDelete(false);
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "Budget bewerken" }} />
      <View style={styles.previewWrap}>
        <BudgetCard budget={budget} transactions={transactions} />
      </View>
      <View style={styles.form}>
        <PickerField label="Categorie" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
        <MoneyField label="Budget deze maand" value={amount} onChangeText={setAmount} />
        <PrimaryButton label="Opslaan" onPress={save} />
        <View style={styles.deleteButton}>
          <SecondaryButton label="Budget verwijderen" onPress={() => setConfirmDelete(true)} />
        </View>
      </View>

      <ConfirmationModal
        visible={confirmDelete}
        title="Budget verwijderen?"
        message="Deze actie kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  previewWrap: { marginTop: spacing.md, marginBottom: spacing.md },
  form: { gap: spacing.xs },
  deleteButton: { marginTop: spacing.lg },
});
