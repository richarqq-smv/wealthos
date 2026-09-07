import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";

interface FieldLabelProps {
  label: string;
  error?: string;
}

export function FieldWrapper({
  label,
  error,
  children,
}: FieldLabelProps & { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xxs }]}>
        {label}
      </Text>
      {children}
      {error ? (
        <Text style={[typography.micro, { color: colors.negative, marginTop: spacing.xxs }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
});
