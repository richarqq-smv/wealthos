import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { SecondaryButton } from "./SecondaryButton";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Er ging iets mis bij het laden van je gegevens.",
  onRetry,
}: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={32} color={colors.negative} />
      <Text style={[typography.body, { color: colors.textPrimary, textAlign: "center", marginTop: spacing.sm }]}>
        {message}
      </Text>
      {onRetry ? (
        <View style={styles.action}>
          <SecondaryButton label="Opnieuw proberen" onPress={onRetry} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  action: { marginTop: spacing.md },
});
