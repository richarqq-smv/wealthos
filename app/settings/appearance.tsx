import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import type { ThemePreference } from "@/types/models";

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light", label: "Licht", icon: "sunny-outline" },
  { value: "dark", label: "Donker", icon: "moon-outline" },
  { value: "system", label: "Systeem", icon: "phone-portrait-outline" },
];

export default function AppearanceScreen() {
  const { colors } = useTheme();
  const themePreference = useSettingsStore((s) => s.themePreference);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Uiterlijk" }} />
      <Card padded={false} style={styles.card}>
        {OPTIONS.map((option, index) => (
          <Pressable
            key={option.value}
            onPress={() => setThemePreference(option.value)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index < OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name={option.icon} size={20} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
            {themePreference === option.value ? (
              <Ionicons name="checkmark" size={20} color={colors.accent} />
            ) : null}
          </Pressable>
        ))}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
  },
});
