import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { MoneyText } from "@/components/MoneyText";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { TextField } from "@/components/form/TextField";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { DateField } from "@/components/form/DateField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { ALL_CATEGORIES, TRANSACTION_CATEGORY_LABEL, TRANSACTION_TYPE_LABEL } from "@/constants/categories";
import { useTransactionsStore } from "@/store/transactionsStore";
import { useAccountsStore } from "@/store/accountsStore";
import { formatDateLong } from "@/utils/date";
import type { TransactionCategory, TransactionType } from "@/types/models";

const TYPE_OPTIONS = (Object.keys(TRANSACTION_TYPE_LABEL) as TransactionType[]).map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABEL[value],
}));
const CATEGORY_OPTIONS = ALL_CATEGORIES.map((value) => ({ value, label: TRANSACTION_CATEGORY_LABEL[value] }));

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const transactions = useTransactionsStore((s) => s.transactions);
  const editTransaction = useTransactionsStore((s) => s.editTransaction);
  const removeTransaction = useTransactionsStore((s) => s.removeTransaction);
  const accounts = useAccountsStore((s) => s.accounts);

  const transaction = transactions.find((t) => t.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
  const [amount, setAmount] = useState(transaction ? String(transaction.amountMinor / 100).replace(".", ",") : "");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [category, setCategory] = useState<TransactionCategory>(transaction?.category ?? "overig");
  const [accountId, setAccountId] = useState(transaction?.accountId ?? "");
  const [date, setDate] = useState(transaction?.date ?? "");
  const [note, setNote] = useState(transaction?.note ?? "");

  if (!transaction) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Transactie" }} />
        <EmptyState icon="alert-circle-outline" title="Transactie niet gevonden" description="Deze transactie bestaat niet meer." />
      </ScreenContainer>
    );
  }

  const account = accounts.find((a) => a.id === transaction.accountId);
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  const startEdit = () => {
    setType(transaction.type);
    setAmount(String(transaction.amountMinor / 100).replace(".", ","));
    setDescription(transaction.description);
    setCategory(transaction.category);
    setAccountId(transaction.accountId);
    setDate(transaction.date);
    setNote(transaction.note ?? "");
    setIsEditing(true);
  };

  const saveEdit = async () => {
    await editTransaction(transaction.id, {
      type,
      amountMinor: parseMoneyInputToMinor(amount || "0"),
      description: description.trim() || transaction.description,
      category,
      accountId,
      date,
      note: note.trim() || undefined,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await removeTransaction(transaction.id);
    setConfirmDelete(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Transactie",
          headerRight: () =>
            isEditing ? null : (
              <IconButton name="create-outline" onPress={startEdit} accessibilityLabel="Bewerken" />
            ),
        }}
      />

      {isEditing ? (
        <View style={styles.form}>
          <PickerField label="Type" value={type} options={TYPE_OPTIONS} onChange={setType} />
          <MoneyField label="Bedrag" value={amount} onChangeText={setAmount} />
          <TextField label="Omschrijving" value={description} onChangeText={setDescription} />
          <PickerField label="Categorie" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
          <PickerField label="Rekening" value={accountId} options={accountOptions} onChange={setAccountId} />
          <DateField label="Datum" value={date} onChange={setDate} />
          <TextField label="Notitie" value={note} onChangeText={setNote} multiline />
          <View style={styles.editActions}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Annuleren" onPress={() => setIsEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Opslaan" onPress={saveEdit} />
            </View>
          </View>
        </View>
      ) : (
        <>
          <Card style={styles.headerCard}>
            <MoneyText
              minor={transaction.amountMinor * (transaction.type === "income" ? 1 : -1)}
              signed
              variant="display"
            />
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {transaction.description}
            </Text>
          </Card>

          <Card>
            <MetaRow label="Type" value={TRANSACTION_TYPE_LABEL[transaction.type]} />
            <MetaRow label="Categorie" value={TRANSACTION_CATEGORY_LABEL[transaction.category]} />
            <MetaRow label="Rekening" value={account?.name ?? "Onbekend"} />
            <MetaRow label="Datum" value={formatDateLong(transaction.date)} />
            {transaction.note ? <MetaRow label="Notitie" value={transaction.note} last /> : null}
          </Card>

          <View style={styles.deleteButton}>
            <SecondaryButton label="Transactie verwijderen" onPress={() => setConfirmDelete(true)} />
          </View>
        </>
      )}

      <ConfirmationModal
        visible={confirmDelete}
        title="Transactie verwijderen?"
        message="Deze actie kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScreenContainer>
  );
}

function MetaRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.metaRow,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md },
  editActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  headerCard: { marginBottom: spacing.md },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  deleteButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
