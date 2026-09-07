import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { TextField } from "@/components/form/TextField";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { seedDemoData } from "@/features/demoData/seed";
import { refreshAllFinancialData } from "@/store";

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const setUserName = useSettingsStore((s) => s.setUserName);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const start = async (demoMode: boolean) => {
    setIsStarting(true);
    try {
      if (name.trim()) {
        await setUserName(name.trim());
      }
      if (demoMode) {
        await seedDemoData();
      }
      await completeOnboarding(demoMode);
      await refreshAllFinancialData();
      router.replace("/(tabs)");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <View style={styles.hero}>
        <View style={[styles.iconCircle, { backgroundColor: colors.accentMuted }]}>
          <Ionicons name="trending-up" size={32} color={colors.accent} />
        </View>
        <Text style={[typography.display, { color: colors.textPrimary, textAlign: "center" }]}>WealthOS</Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
          ]}
        >
          Jouw volledige financiële leven, op één scherm. Bekijk je vermogen, rekeningen, beleggingen en
          uitgaven allemaal op één plek — volledig lokaal en privé.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Hoe mogen we je noemen? (optioneel)"
          value={name}
          onChangeText={setName}
          placeholder="Bijv. Sam"
        />
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Start met demo-data" onPress={() => start(true)} loading={isStarting} />
        <SecondaryButton label="Begin leeg" onPress={() => start(false)} disabled={isStarting} />
        <Text style={[typography.micro, { color: colors.textTertiary, textAlign: "center", marginTop: spacing.sm }]}>
          WealthOS is een persoonlijke financiële tracker en geeft geen financieel advies.
        </Text>
        <Text style={[typography.micro, { color: colors.textTertiary, textAlign: "center" }]}>
          Live beurskoersen zijn optioneel en kun je later instellen via Instellingen → Live marktdata.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  form: { marginBottom: spacing.lg },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
});
