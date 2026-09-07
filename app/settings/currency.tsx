import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import type { CurrencyCode } from "@/types/models";

const OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "Amerikaanse dollar ($)" },
  { value: "GBP", label: "Britse pond (£)" },
  { value: "CHF", label: "Zwitserse frank (CHF)" },
];

export default function CurrencyScreen() {
  const { colors } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Valuta" }} />
      <Card padded={false} style={styles.card}>
        {OPTIONS.map((option, index) => (
          <Pressable
            key={option.value}
            onPress={() => setCurrency(option.value)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index < OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
            {currency === option.value ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
          </Pressable>
        ))}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
  },
});
