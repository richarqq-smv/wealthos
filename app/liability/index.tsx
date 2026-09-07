import { StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { MoneyText } from "@/components/MoneyText";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { DataOriginBadge } from "@/components/DataOriginBadge";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useLiabilitiesStore } from "@/store/liabilitiesStore";
import { LIABILITY_TYPE_LABEL } from "@/constants/categories";
import { calculateTotalLiabilities } from "@/lib/calculations";

export default function LiabilitiesScreen() {
  const { colors } = useTheme();
  const liabilities = useLiabilitiesStore((s) => s.liabilities);
  const total = calculateTotalLiabilities(liabilities);

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Schulden",
          headerRight: () => (
            <IconButton name="add-circle-outline" onPress={() => router.push("/liability/add")} accessibilityLabel="Schuld toevoegen" />
          ),
        }}
      />

      <Card style={styles.totalCard}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>Totale schulden</Text>
        <MoneyText minor={total} variant="display" colorOverride={colors.negative} style={{ marginTop: spacing.xxs }} />
      </Card>

      {liabilities.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="Geen schulden geregistreerd"
          description="Voeg bijvoorbeeld een hypotheek of studieschuld toe om je netto vermogen compleet te maken."
          actionLabel="Schuld toevoegen"
          onAction={() => router.push("/liability/add")}
        />
      ) : (
        <View style={styles.list}>
          {liabilities.map((liability) => (
            <Card key={liability.id} onPress={() => router.push(`/liability/${liability.id}`)} style={styles.row}>
              <View style={styles.info}>
                <DataOriginBadge origin={liability.origin} />
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xxs }]}>
                  {liability.name}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {LIABILITY_TYPE_LABEL[liability.type]}
                  {liability.interestRate ? ` · ${liability.interestRate}% rente` : ""}
                </Text>
              </View>
              <MoneyText minor={liability.amountMinor} variant="medium" colorOverride={colors.negative} />
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  totalCard: { marginBottom: spacing.md },
  list: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  info: { flex: 1 },
});
