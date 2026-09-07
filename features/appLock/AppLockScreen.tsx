import { useCallback, useEffect, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { SecondaryButton } from "@/components/SecondaryButton";
import { PinPad } from "./PinPad";

export function AppLockScreen() {
  const { colors } = useTheme();
  const appLockMethod = useSettingsStore((s) => s.appLockMethod);
  const checkPin = useSettingsStore((s) => s.checkPin);
  const unlock = useSettingsStore((s) => s.unlock);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const tryBiometric = useCallback(async () => {
    setBiometricError(null);
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      setBiometricError("Biometrie is niet beschikbaar op dit apparaat.");
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Ontgrendel WealthOS",
      cancelLabel: "Annuleren",
    });
    if (result.success) {
      unlock();
    }
  }, [unlock]);

  useEffect(() => {
    if (appLockMethod === "biometric") {
      tryBiometric();
    }
  }, [appLockMethod, tryBiometric]);

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      checkPin(next).then((valid) => {
        if (valid) {
          unlock();
          setPin("");
        } else {
          setError(true);
          setTimeout(() => setPin(""), 300);
        }
      });
    }
  };

  return (
    <Modal visible transparent={false} animationType="fade">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.accentMuted }]}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.accent} />
        </View>
        <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: spacing.xxl }]}>
          WealthOS is vergrendeld
        </Text>

        {appLockMethod === "pin" ? (
          <PinPad pin={pin} onDigit={handleDigit} onBackspace={() => setPin(pin.slice(0, -1))} error={error} />
        ) : (
          <View style={styles.biometricContainer}>
            {biometricError ? (
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>
                {biometricError}
              </Text>
            ) : null}
            <SecondaryButton label="Probeer opnieuw" onPress={tryBiometric} fullWidth={false} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  biometricContainer: { alignItems: "center", gap: spacing.md },
});
