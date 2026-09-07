import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { MoneyText } from "@/components/MoneyText";
import { PortfolioChart } from "@/components/PortfolioChart";
import { TransactionRow } from "@/components/TransactionRow";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { TextField } from "@/components/form/TextField";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { DataOriginBadge } from "@/components/DataOriginBadge";
import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { ACCOUNT_TYPE_LABEL } from "@/constants/categories";
import { useAccountsStore } from "@/store/accountsStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { formatDateLong } from "@/utils/date";
import type { AccountType } from "@/types/models";

const TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((value) => ({
  value,
  label: ACCOUNT_TYPE_LABEL[value],
}));

const SIGN: Record<string, number> = { income: 1, expense: -1, transfer: 0, investment: -1 };

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const editAccount = useAccountsStore((s) => s.editAccount);
  const removeAccount = useAccountsStore((s) => s.removeAccount);
  const transactions = useTransactionsStore((s) => s.transactions);

  const account = accounts.find((a) => a.id === id);
  const accountTransactions = useMemo(
    () => transactions.filter((t) => t.accountId === id),
    [transactions, id]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [balance, setBalance] = useState(account ? String(account.balanceMinor / 100).replace(".", ",") : "");

  const chartPoints = useMemo(() => {
    if (!account) return [];
    const sorted = [...accountTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const netEffect = sorted.reduce((sum, t) => sum + t.amountMinor * (SIGN[t.type] ?? 0), 0);
    let running = account.balanceMinor - netEffect;
    const points = [{ date: sorted[0]?.date ?? account.createdAt, valueMinor: running }];
    for (const t of sorted) {
      running += t.amountMinor * (SIGN[t.type] ?? 0);
      points.push({ date: t.date, valueMinor: running });
    }
    return points;
  }, [account, accountTransactions]);

  if (!account) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Rekening" }} />
        <EmptyState icon="alert-circle-outline" title="Rekening niet gevonden" description="Deze rekening bestaat niet meer." />
      </ScreenContainer>
    );
  }

  const startEdit = () => {
    setName(account.name);
    setInstitution(account.institution);
    setType(account.type);
    setBalance(String(account.balanceMinor / 100).replace(".", ","));
    setIsEditing(true);
  };

  const saveEdit = async () => {
    await editAccount(account.id, {
      name: name.trim() || account.name,
      institution: institution.trim(),
      type,
      balanceMinor: parseMoneyInputToMinor(balance || "0"),
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await removeAccount(account.id);
    setConfirmDelete(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: account.name,
          headerRight: () =>
            isEditing ? null : (
              <IconButton name="create-outline" onPress={startEdit} accessibilityLabel="Bewerken" />
            ),
        }}
      />

      {isEditing ? (
        <View style={styles.form}>
          <TextField label="Naam" value={name} onChangeText={setName} />
          <TextField label="Bank / instituut" value={institution} onChangeText={setInstitution} />
          <PickerField label="Type" value={type} options={TYPE_OPTIONS} onChange={setType} />
          <MoneyField label="Saldo" value={balance} onChangeText={setBalance} />
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
            <DataOriginBadge origin={account.origin} />
            <MoneyText minor={account.balanceMinor} variant="display" style={{ marginTop: spacing.xs }} currency={account.currency} />
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
              {account.institution} · {ACCOUNT_TYPE_LABEL[account.type]}
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xxs }]}>
              Laatst bijgewerkt op {formatDateLong(account.updatedAt)}
            </Text>
          </Card>

          <Card style={styles.section}>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Saldo over tijd
            </Text>
            <PortfolioChart points={chartPoints} />
          </Card>

          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Transacties</Text>
          {accountTransactions.length === 0 ? (
            <EmptyState icon="swap-vertical-outline" title="Nog geen transacties" description="Deze rekening heeft nog geen transacties." />
          ) : (
            <Card>
              {accountTransactions.slice(0, 20).map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </Card>
          )}

          <View style={styles.deleteButton}>
            <SecondaryButton label="Rekening verwijderen" onPress={() => setConfirmDelete(true)} />
          </View>
        </>
      )}

      <ConfirmationModal
        visible={confirmDelete}
        title="Rekening verwijderen?"
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
  form: { paddingTop: spacing.md },
  editActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  headerCard: { marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  deleteButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
