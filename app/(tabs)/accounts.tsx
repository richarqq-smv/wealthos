import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/Card";
import { MoneyText } from "@/components/MoneyText";
import { AccountCard } from "@/components/AccountCard";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useAccountsStore } from "@/store/accountsStore";
import { useLiabilitiesStore } from "@/store/liabilitiesStore";
import { calculateTotalCash, calculateTotalLiabilities } from "@/lib/calculations";
import { ACCOUNT_TYPE_LABEL } from "@/constants/categories";
import type { AccountType } from "@/types/models";

const GROUP_ORDER: AccountType[] = ["checking", "savings", "cash", "other"];

export default function AccountsScreen() {
  const { colors } = useTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const liabilities = useLiabilitiesStore((s) => s.liabilities);
  const totalCash = calculateTotalCash(accounts);
  const totalLiabilities = calculateTotalLiabilities(liabilities);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((type) => ({
      type,
      accounts: accounts.filter((a) => a.type === type),
    })).filter((group) => group.accounts.length > 0);
  }, [accounts]);

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <AppHeader title="Rekeningen" />
        <IconButton
          name="add-circle-outline"
          onPress={() => router.push("/account/add")}
          accessibilityLabel="Rekening toevoegen"
        />
      </View>

      <Card style={styles.totalCard}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>Totaal cash</Text>
        <MoneyText minor={totalCash} variant="display" style={{ marginTop: spacing.xxs }} />
      </Card>

      {accounts.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="Nog geen rekeningen"
          description="Voeg je eerste rekening toe om je cash te volgen."
          actionLabel="Rekening toevoegen"
          onAction={() => router.push("/account/add")}
        />
      ) : (
        grouped.map((group) => (
          <View key={group.type} style={styles.group}>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              {ACCOUNT_TYPE_LABEL[group.type]}
              {group.type === "checking" ? "en" : group.type === "savings" ? "en" : ""}
            </Text>
            <View style={styles.list}>
              {group.accounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </View>
          </View>
        ))
      )}

      <Card onPress={() => router.push("/liability")} style={styles.liabilityCard}>
        <View>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Schulden</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {liabilities.length} {liabilities.length === 1 ? "post" : "posten"}
          </Text>
        </View>
        <MoneyText minor={totalLiabilities} variant="medium" colorOverride={colors.negative} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalCard: { marginBottom: spacing.md },
  group: { marginBottom: spacing.md },
  list: { gap: spacing.xs },
  liabilityCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
});
