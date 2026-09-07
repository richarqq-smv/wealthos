import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, touchSize, typography } from "@/constants/theme";
import { FieldWrapper } from "./FieldLabel";
import { BottomSheet } from "../BottomSheet";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
}

interface PickerFieldProps<T extends string> {
  label: string;
  value: T;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  error?: string;
}

export function PickerField<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: PickerFieldProps<T>) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <FieldWrapper label={label} error={error}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.field,
          { backgroundColor: colors.surfaceMuted, borderColor: error ? colors.negative : colors.border },
        ]}
      >
        <Text style={[typography.body, { color: colors.textPrimary }]}>{selected?.label ?? "Selecteer"}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>{label}</Text>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            style={[styles.option, { borderBottomColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[typography.body, { color: colors.textPrimary }]}>{option.label}</Text>
            {option.value === value ? (
              <Ionicons name="checkmark" size={20} color={colors.accent} />
            ) : null}
          </Pressable>
        ))}
      </BottomSheet>
    </FieldWrapper>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: touchSize.min,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
