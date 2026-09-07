import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, touchSize, typography } from "@/constants/theme";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  destructive?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = true,
  destructive = false,
}: PrimaryButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: destructive ? colors.negative : colors.accent,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text style={[typography.bodyMedium, { color: colors.onAccent, fontWeight: "600" }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchSize.min,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  fullWidth: { width: "100%" },
});
