import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { BottomSheet } from "@/components/BottomSheet";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { PinPad } from "@/features/appLock/PinPad";
import type { AppLockMethod } from "@/types/models";

const OPTIONS: { value: AppLockMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "none", label: "Uit", icon: "lock-open-outline" },
  { value: "pin", label: "PIN-code", icon: "keypad-outline" },
  { value: "biometric", label: "Biometrie (Face ID / vingerafdruk)", icon: "finger-print-outline" },
];

export default function SecurityScreen() {
  const { colors } = useTheme();
  const appLockMethod = useSettingsStore((s) => s.appLockMethod);
  const setPin = useSettingsStore((s) => s.setPin);
  const removePin = useSettingsStore((s) => s.removePin);
  const setAppLockMethod = useSettingsStore((s) => s.setAppLockMethod);

  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null);

  const startPinSetup = () => {
    setStep("enter");
    setFirstPin("");
    setPinValue("");
    setPinError(false);
    setPinSheetOpen(true);
  };

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPinValue(next);
    if (next.length === 4) {
      if (step === "enter") {
        setFirstPin(next);
        setStep("confirm");
        setPinValue("");
      } else {
        if (next === firstPin) {
          setPin(next).then(() => setPinSheetOpen(false));
        } else {
          setPinError(true);
          setTimeout(() => {
            setPinError(false);
            setStep("enter");
            setFirstPin("");
            setPinValue("");
          }, 500);
        }
      }
    }
  };

  const selectMethod = async (method: AppLockMethod) => {
    setBiometricMessage(null);
    if (method === "none") {
      await removePin();
      return;
    }
    if (method === "pin") {
      startPinSetup();
      return;
    }
    if (method === "biometric") {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        setBiometricMessage("Biometrie is niet beschikbaar of niet ingesteld op dit apparaat.");
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Bevestig biometrie" });
      if (result.success) {
        await setAppLockMethod("biometric");
      }
    }
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "App-vergrendeling" }} />
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }]}>
        Bescherm WealthOS met een extra vergrendeling wanneer je de app opent.
      </Text>

      <Card padded={false}>
        {OPTIONS.map((option, index) => (
          <Pressable
            key={option.value}
            onPress={() => selectMethod(option.value)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index < OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name={option.icon} size={20} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
            {appLockMethod === option.value ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
          </Pressable>
        ))}
      </Card>

      {biometricMessage ? (
        <Text style={[typography.caption, { color: colors.negative, marginTop: spacing.sm }]}>{biometricMessage}</Text>
      ) : null}

      <BottomSheet visible={pinSheetOpen} onClose={() => setPinSheetOpen(false)}>
        <View style={styles.pinSheet}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.lg }]}>
            {step === "enter" ? "Kies een PIN-code" : "Bevestig je PIN-code"}
          </Text>
          <PinPad pin={pin} onDigit={handleDigit} onBackspace={() => setPinValue(pin.slice(0, -1))} error={pinError} />
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
  },
  pinSheet: { alignItems: "center", paddingBottom: spacing.xl },
});
