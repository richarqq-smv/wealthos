import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { spacing } from "@/constants/theme";
import { EXPENSE_CATEGORIES, TRANSACTION_CATEGORY_LABEL } from "@/constants/categories";
import { useBudgetsStore } from "@/store/budgetsStore";
import { monthKey } from "@/utils/date";
import type { TransactionCategory } from "@/types/models";

const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((value) => ({ value, label: TRANSACTION_CATEGORY_LABEL[value] }));

export default function AddBudgetScreen() {
  const addBudget = useBudgetsStore((s) => s.addBudget);
  const [category, setCategory] = useState<TransactionCategory>("boodschappen");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const amountMinor = parseMoneyInputToMinor(amount || "0");
    if (!amount || amountMinor <= 0) {
      setError("Het bedrag is ongeldig.");
      return;
    }
    setIsSaving(true);
    try {
      await addBudget({ category, month: monthKey(), amountMinor });
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "Budget toevoegen" }} />
      <View style={styles.form}>
        <PickerField label="Categorie" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
        <MoneyField label="Budget deze maand" value={amount} onChangeText={setAmount} error={error} />
        <PrimaryButton label="Budget opslaan" onPress={handleSave} loading={isSaving} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md },
});
