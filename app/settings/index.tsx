import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { TextField } from "@/components/form/TextField";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { useProfileStore } from "@/store/profileStore";
import { useState } from "react";

interface Row {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  route?: Parameters<typeof router.push>[0];
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>{title}</Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

function NavRow({ row, isLast }: { row: Row; isLast: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={row.route ? () => router.push(row.route!) : undefined}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={row.icon} size={20} color={colors.textSecondary} />
      <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{row.label}</Text>
      {row.value ? (
        <Text style={[typography.caption, { color: colors.textTertiary }]}>{row.value}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const userName = useSettingsStore((s) => s.userName);
  const setUserName = useSettingsStore((s) => s.setUserName);
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const setPrivacyMode = useSettingsStore((s) => s.setPrivacyMode);
  const themePreference = useSettingsStore((s) => s.themePreference);
  const currency = useSettingsStore((s) => s.currency);
  const marketDataEnabled = useSettingsStore((s) => s.marketData.enabled);
  const activeProfileName = useProfileStore((s) => s.activeProfile?.name ?? "");
  const [name, setName] = useState(userName);

  const themeLabel = { light: "Licht", dark: "Donker", system: "Systeem" }[themePreference];

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Instellingen" }} />

      <SectionCard title="Profiel">
        <View style={styles.padded}>
          <TextField
            label="Naam"
            value={name}
            onChangeText={setName}
            onBlur={() => setUserName(name)}
            placeholder="Jouw naam"
          />
        </View>
      </SectionCard>

      <SectionCard title="Voorkeuren">
        <NavRow row={{ icon: "color-palette-outline", label: "Uiterlijk", value: themeLabel, route: "/settings/appearance" }} isLast={false} />
        <NavRow row={{ icon: "cash-outline", label: "Valuta", value: currency, route: "/settings/currency" }} isLast />
      </SectionCard>

      <SectionCard title="Privacy">
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View style={styles.privacyLabel}>
            <Ionicons name="eye-off-outline" size={20} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.textPrimary }]}>Privacy-modus</Text>
          </View>
          <Switch value={privacyMode} onValueChange={setPrivacyMode} trackColor={{ true: colors.accent }} />
        </View>
      </SectionCard>
      <Text style={[typography.micro, { color: colors.textTertiary, marginTop: -spacing.sm, marginBottom: spacing.md, marginLeft: spacing.xs }]}>
        Verberg financiële bedragen op het scherm.
      </Text>

      <SectionCard title="Account">
        <NavRow row={{ icon: "person-circle-outline", label: "Profiel", value: activeProfileName, route: "/settings/profile" }} isLast />
      </SectionCard>

      <SectionCard title="Data">
        <NavRow row={{ icon: "server-outline", label: "Exporteren, importeren & reset", route: "/settings/data" }} isLast />
      </SectionCard>

      <SectionCard title="Marktdata">
        <NavRow
          row={{
            icon: "trending-up-outline",
            label: "Live marktdata",
            value: marketDataEnabled ? "Aan" : "Uit",
            route: "/settings/marketData",
          }}
          isLast
        />
      </SectionCard>

      <SectionCard title="Over">
        <View style={styles.padded}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>WealthOS 0.4.1</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            WealthOS is een persoonlijke financiële tracker en geeft geen financieel advies.
          </Text>
        </View>
      </SectionCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
  },
  padded: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  privacyLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
