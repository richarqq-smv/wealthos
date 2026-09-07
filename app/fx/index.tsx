import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { useAccountsStore } from "@/store/accountsStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { useSettingsStore } from "@/store/settingsStore";

const COMMON_PAIRS = ["USD", "GBP"];

export default function FxListScreen() {
  const { colors } = useTheme();
  const baseCurrency = useSettingsStore((s) => s.currency);
  const accounts = useAccountsStore((s) => s.accounts);
  const investments = useInvestmentsStore((s) => s.investments);

  const pairs = useMemo(() => {
    const currencies = new Set<string>(COMMON_PAIRS);
    for (const account of accounts) currencies.add(account.currency);
    for (const investment of investments) currencies.add(investment.currency);
    currencies.delete(baseCurrency);
    return Array.from(currencies).sort();
  }, [accounts, investments, baseCurrency]);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Wisselkoersen" }} />

      {pairs.length === 0 ? (
        <EmptyState
          icon="swap-horizontal-outline"
          title="Geen vreemde valuta"
          description="Je hebt nog geen rekeningen of beleggingen in een andere valuta dan je basisvaluta."
        />
      ) : (
        <Card padded={false}>
          {pairs.map((currency, index) => (
            <Pressable
              key={currency}
              onPress={() => router.push(`/fx/${baseCurrency}-${currency}`)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                index < pairs.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.textSecondary} />
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>
                {baseCurrency}/{currency}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          ))}
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
  },
});
