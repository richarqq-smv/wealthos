import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { SearchBar } from "@/components/SearchBar";
import { FilterChips } from "@/components/FilterChips";
import { Card } from "@/components/Card";
import { TransactionRow } from "@/components/TransactionRow";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useTransactionsStore } from "@/store/transactionsStore";
import { groupLabelForDate } from "@/utils/date";
import { TRANSACTION_CATEGORY_LABEL } from "@/constants/categories";
import type { Transaction, TransactionType } from "@/types/models";

const TYPE_FILTERS: { value: TransactionType | "alle"; label: string }[] = [
  { value: "alle", label: "Alles" },
  { value: "income", label: "Inkomsten" },
  { value: "expense", label: "Uitgaven" },
  { value: "investment", label: "Beleggingen" },
  { value: "transfer", label: "Overboekingen" },
];

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const transactions = useTransactionsStore((s) => s.transactions);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "alle">("alle");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== "alle" && t.type !== typeFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        t.description.toLowerCase().includes(q) ||
        TRANSACTION_CATEGORY_LABEL[t.category].toLowerCase().includes(q)
      );
    });
  }, [transactions, typeFilter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const label = groupLabelForDate(t.date);
      const list = map.get(label) ?? [];
      list.push(t);
      map.set(label, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <AppHeader title="Transacties" />
        <IconButton name="add-circle-outline" onPress={() => router.push("/transaction/add")} accessibilityLabel="Transactie toevoegen" />
      </View>

      <View style={styles.searchRow}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Zoek op naam of categorie" />
      </View>
      <View style={styles.filterRow}>
        <FilterChips options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
      </View>

      {groups.length === 0 ? (
        <EmptyState
          icon="swap-vertical-outline"
          title="Geen transacties gevonden"
          description="Voeg een transactie toe of pas je filters aan."
          actionLabel="Transactie toevoegen"
          onAction={() => router.push("/transaction/add")}
        />
      ) : (
        groups.map(([label, items]) => (
          <View key={label} style={styles.group}>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              {label}
            </Text>
            <Card>
              {items.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </Card>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  searchRow: { marginBottom: spacing.sm },
  filterRow: { marginBottom: spacing.md },
  group: { marginBottom: spacing.md },
});
