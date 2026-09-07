import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { iconSize, radius, touchSize } from "@/constants/theme";

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  accessibilityLabel: string;
}

export function IconButton({
  name,
  onPress,
  size = iconSize.lg,
  color,
  backgroundColor,
  accessibilityLabel,
}: IconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: backgroundColor ?? "transparent",
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: touchSize.min,
    minHeight: touchSize.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
});
