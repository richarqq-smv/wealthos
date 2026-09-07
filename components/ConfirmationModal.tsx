import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, typography } from "@/constants/theme";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel = "Bevestigen",
  cancelLabel = "Annuleren",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Sluiten" />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
            {message}
          </Text>
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <SecondaryButton label={cancelLabel} onPress={onCancel} />
            </View>
            <View style={styles.actionButton}>
              <PrimaryButton label={confirmLabel} onPress={onConfirm} destructive={destructive} />
            </View>
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
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: { flex: 1 },
});
