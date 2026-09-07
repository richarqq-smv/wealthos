import { StyleSheet, TextInput, type KeyboardTypeOptions } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, touchSize, typography } from "@/constants/theme";
import { FieldWrapper } from "./FieldLabel";

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onBlur?: () => void;
  secureTextEntry?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  multiline = false,
  autoCapitalize = "sentences",
  onBlur,
  secureTextEntry = false,
}: TextFieldProps) {
  const { colors } = useTheme();

  return (
    <FieldWrapper label={label} error={error}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        onBlur={onBlur}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={label}
        style={[
          typography.body,
          styles.input,
          multiline && styles.multiline,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surfaceMuted,
            borderColor: error ? colors.negative : colors.border,
          },
        ]}
      />
    </FieldWrapper>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: touchSize.min,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  multiline: {
    minHeight: 88,
    paddingTop: spacing.sm,
    textAlignVertical: "top",
  },
});
