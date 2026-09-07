import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, touchSize, typography } from "@/constants/theme";
import { FieldWrapper } from "./FieldLabel";

interface MoneyFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  currencySymbol?: string;
}

/** Accepts Dutch-formatted decimal input ("1.250,50") as raw text; parsing to minor units happens on submit. */
export function MoneyField({ label, value, onChangeText, error, currencySymbol = "€" }: MoneyFieldProps) {
  const { colors } = useTheme();

  const handleChange = (text: string) => {
    const sanitized = text.replace(/[^0-9,.-]/g, "");
    onChangeText(sanitized);
  };

  return (
    <FieldWrapper label={label} error={error}>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surfaceMuted, borderColor: error ? colors.negative : colors.border },
        ]}
      >
        <Text style={[typography.body, { color: colors.textSecondary }]}>{currencySymbol}</Text>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder="0,00"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          style={[typography.body, styles.input, { color: colors.textPrimary }]}
        />
      </View>
    </FieldWrapper>
  );
}

export function parseMoneyInputToMinor(text: string): number {
  const normalized = text.replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touchSize.min,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    gap: spacing.xxs,
  },
  input: { flex: 1, height: "100%" },
});
