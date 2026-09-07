import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { ACCOUNT_TYPE_LABEL } from "@/constants/categories";
import { formatDateShort } from "@/utils/date";
import { Card } from "./Card";
import { MoneyText } from "./MoneyText";
import type { Account } from "@/types/models";

const ACCOUNT_ICON: Record<Account["type"], keyof typeof Ionicons.glyphMap> = {
  checking: "card-outline",
  savings: "wallet-outline",
  cash: "cash-outline",
  other: "ellipsis-horizontal-circle-outline",
};

export function AccountCard({ account }: { account: Account }) {
  const { colors } = useTheme();

  return (
    <Card onPress={() => router.push(`/account/${account.id}`)} style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: colors.accentMuted }]}>
        <Ionicons name={ACCOUNT_ICON[account.type]} size={20} color={colors.accent} />
      </View>
      <View style={styles.info}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {account.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
          {account.institution} · {ACCOUNT_TYPE_LABEL[account.type]}
        </Text>
      </View>
      <View style={styles.trailing}>
        <MoneyText minor={account.balanceMinor} variant="medium" currency={account.currency} />
        <Text style={[typography.micro, { color: colors.textTertiary }]}>
          {formatDateShort(account.updatedAt)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
  trailing: { alignItems: "flex-end" },
});
