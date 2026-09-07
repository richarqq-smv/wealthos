import { Text, type TextStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { typography } from "@/constants/theme";
import { formatPercentage } from "@/utils/money";

interface PercentageTextProps {
  fraction: number;
  signed?: boolean;
  style?: TextStyle;
  neutral?: boolean;
}

export function PercentageText({ fraction, signed = true, style, neutral = false }: PercentageTextProps) {
  const { colors } = useTheme();
  const color = neutral
    ? colors.textSecondary
    : fraction > 0
      ? colors.positive
      : fraction < 0
        ? colors.negative
        : colors.textSecondary;

  return (
    <Text style={[typography.caption, { color, fontWeight: "600" }, style]}>
      {formatPercentage(fraction, { signed })}
    </Text>
  );
}
