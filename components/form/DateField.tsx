import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, touchSize, typography } from "@/constants/theme";
import { formatDateShort } from "@/utils/date";
import { FieldWrapper } from "./FieldLabel";

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
}

export function DateField({ label, value, onChange, error }: DateFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : new Date();

  if (Platform.OS === "web") {
    return (
      <FieldWrapper label={label} error={error}>
        <input
          type="date"
          value={value ? value.slice(0, 10) : ""}
          onChange={(e) => onChange(new Date(e.target.value).toISOString())}
          style={{
            height: touchSize.min,
            borderRadius: radius.md,
            border: `1px solid ${error ? colors.negative : colors.border}`,
            backgroundColor: colors.surfaceMuted,
            color: colors.textPrimary,
            paddingLeft: spacing.sm,
            paddingRight: spacing.sm,
            fontSize: typography.body.fontSize,
            width: "100%",
          }}
        />
      </FieldWrapper>
    );
  }

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
        <Text style={[typography.body, { color: colors.textPrimary }]}>{formatDateShort(date.toISOString())}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setOpen(Platform.OS === "ios");
            if (event.type === "set" && selectedDate) {
              onChange(selectedDate.toISOString());
            }
          }}
        />
      ) : null}
    </FieldWrapper>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: touchSize.min,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
});
