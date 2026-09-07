import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { calculateInvestedCapital, calculateInvestmentValue, calculateProfitLoss, calculateReturnPercentage } from "@/lib/calculations";
import { Card } from "./Card";
import { MoneyText } from "./MoneyText";
import { PercentageText } from "./PercentageText";
import type { Investment } from "@/types/models";

export function InvestmentCard({ investment }: { investment: Investment }) {
  const { colors } = useTheme();
  const currentValue = calculateInvestmentValue(investment);
  const invested = calculateInvestedCapital(investment);
  const profitLoss = calculateProfitLoss(currentValue, invested);
  const returnPct = calculateReturnPercentage(invested, profitLoss);

  return (
    <Card onPress={() => router.push(`/investment/${investment.id}`)} style={styles.card}>
      <View style={styles.info}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {investment.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {investment.ticker} · {investment.quantity} stuks
        </Text>
      </View>
      <View style={styles.trailing}>
        <MoneyText minor={currentValue} variant="medium" currency={investment.currency} />
        <PercentageText fraction={returnPct} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  info: { flex: 1 },
  trailing: { alignItems: "flex-end", gap: 2 },
});
