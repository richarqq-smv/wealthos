import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, typography } from "@/constants/theme";
import { PrimaryButton } from "./PrimaryButton";

interface InfoModalProps {
  visible: boolean;
  title: string;
  message?: string;
  dismissLabel?: string;
  onDismiss: () => void;
}

/**
 * A themed, single-button alert. React Native's own `Alert.alert` is a
 * no-op on web (react-native-web ships an empty stub), which would make
 * every export/import/validation message silently disappear on desktop —
 * this component works identically on every platform instead.
 */
export function InfoModal({ visible, title, message, dismissLabel = "OK", onDismiss }: InfoModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Sluiten" />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
          {message ? (
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
              {message}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <PrimaryButton label={dismissLabel} onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  actions: {
    marginTop: spacing.lg,
  },
});
