import { Text, type TextStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { usePrivacyFormat } from "@/hooks/usePrivacyFormat";
import { typography } from "@/constants/theme";
import { formatMoneySigned } from "@/utils/money";
import type { CurrencyCode } from "@/types/models";

type Variant = "display" | "large" | "medium" | "body";

interface MoneyTextProps {
  minor: number;
  variant?: Variant;
  signed?: boolean;
  colorOverride?: string;
  currency?: CurrencyCode;
  style?: TextStyle;
  compact?: boolean;
}

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  display: typography.numericLarge,
  large: typography.h1,
  medium: typography.numericMedium,
  body: typography.bodyMedium,
};

export function MoneyText({
  minor,
  variant = "body",
  signed = false,
  colorOverride,
  currency,
  style,
  compact = false,
}: MoneyTextProps) {
  const { colors } = useTheme();
  const { privacyMode, money, moneyCompact } = usePrivacyFormat();

  let text: string;
  if (privacyMode) {
    text = money(minor, { currency });
  } else if (signed) {
    text = formatMoneySigned(minor, currency);
  } else if (compact) {
    text = moneyCompact(minor, currency);
  } else {
    text = money(minor, { currency });
  }

  const color = colorOverride ?? (signed && !privacyMode ? (minor > 0 ? colors.positive : minor < 0 ? colors.negative : colors.textPrimary) : colors.textPrimary);

  return (
    <Text style={[VARIANT_STYLE[variant], { color }, style]} numberOfLines={1} adjustsFontSizeToFit={variant === "display"}>
      {text}
    </Text>
  );
}
