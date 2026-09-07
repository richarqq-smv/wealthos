import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/form/TextField";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { DateField } from "@/components/form/DateField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { EmptyState } from "@/components/EmptyState";
import { spacing } from "@/constants/theme";
import { ALL_CATEGORIES, TRANSACTION_CATEGORY_LABEL, TRANSACTION_TYPE_LABEL } from "@/constants/categories";
import { useTransactionsStore } from "@/store/transactionsStore";
import { useAccountsStore } from "@/store/accountsStore";
import { nowISO } from "@/utils/date";
import type { TransactionCategory, TransactionType } from "@/types/models";

const TYPE_OPTIONS = (Object.keys(TRANSACTION_TYPE_LABEL) as TransactionType[]).map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABEL[value],
}));

const CATEGORY_OPTIONS = ALL_CATEGORIES.map((value) => ({ value, label: TRANSACTION_CATEGORY_LABEL[value] }));

export default function AddTransactionScreen() {
  const addTransaction = useTransactionsStore((s) => s.addTransaction);
  const accounts = useAccountsStore((s) => s.accounts);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("overig");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(nowISO());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  if (accounts.length === 0) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Transactie toevoegen" }} />
        <EmptyState
          icon="wallet-outline"
          title="Voeg eerst een rekening toe"
          description="Een transactie hoort bij een rekening. Maak eerst een rekening aan."
          actionLabel="Rekening toevoegen"
          onAction={() => router.push("/account/add")}
        />
      </ScreenContainer>
    );
  }

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (!description.trim()) nextErrors.description = "Vul een omschrijving in.";
    const amountMinor = parseMoneyInputToMinor(amount || "0");
    if (!amount || amountMinor <= 0) nextErrors.amount = "Het bedrag is ongeldig.";
    if (!accountId) nextErrors.accountId = "Kies een rekening.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    try {
      await addTransaction({
        type,
        amountMinor,
        description: description.trim(),
        category,
        accountId,
        date,
        note: note.trim() || undefined,
      });
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "Transactie toevoegen" }} />
      <View style={styles.form}>
        <PickerField label="Type" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <MoneyField label="Bedrag" value={amount} onChangeText={setAmount} error={errors.amount} />
        <TextField label="Omschrijving" value={description} onChangeText={setDescription} placeholder="Bijv. Albert Heijn" error={errors.description} />
        <PickerField label="Categorie" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
        <PickerField label="Rekening" value={accountId} options={accountOptions} onChange={setAccountId} error={errors.accountId} />
        <DateField label="Datum" value={date} onChange={setDate} />
        <TextField label="Notitie (optioneel)" value={note} onChangeText={setNote} multiline />
        <PrimaryButton label="Transactie opslaan" onPress={handleSave} loading={isSaving} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md },
});
