import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { TRANSACTION_CATEGORY_LABEL } from "@/constants/categories";
import { MoneyText } from "./MoneyText";
import type { Transaction, TransactionCategory } from "@/types/models";

const CATEGORY_ICON: Record<TransactionCategory, keyof typeof Ionicons.glyphMap> = {
  salaris: "briefcase-outline",
  wonen: "home-outline",
  boodschappen: "cart-outline",
  vervoer: "car-outline",
  entertainment: "film-outline",
  abonnementen: "repeat-outline",
  gezondheid: "medkit-outline",
  vakantie: "airplane-outline",
  shopping: "bag-outline",
  belegging: "trending-up-outline",
  overboeking: "swap-horizontal-outline",
  overig: "ellipsis-horizontal-circle-outline",
};

const SIGN: Record<Transaction["type"], 1 | -1> = {
  income: 1,
  expense: -1,
  transfer: -1,
  investment: -1,
};

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { colors } = useTheme();
  const signedMinor = transaction.amountMinor * SIGN[transaction.type];

  return (
    <Pressable
      onPress={() => router.push(`/transaction/${transaction.id}`)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name={CATEGORY_ICON[transaction.category]} size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.info}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {transaction.description}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
          {TRANSACTION_CATEGORY_LABEL[transaction.category]}
        </Text>
      </View>
      <MoneyText minor={signedMinor} signed variant="body" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingVertical: spacing.xs,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
});
