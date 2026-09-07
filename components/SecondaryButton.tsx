import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, touchSize, typography } from "@/constants/theme";

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function SecondaryButton({ label, onPress, disabled = false, fullWidth = true }: SecondaryButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchSize.min,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  fullWidth: { width: "100%" },
});
