import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { IconButton } from "./IconButton";
import { usePrivacyFormat } from "@/hooks/usePrivacyFormat";
import { useSettingsStore } from "@/store/settingsStore";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showPrivacyToggle?: boolean;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

export function AppHeader({ title, subtitle, showPrivacyToggle = false }: AppHeaderProps) {
  const { colors } = useTheme();
  const { privacyMode } = usePrivacyFormat();
  const togglePrivacyMode = useSettingsStore((s) => s.togglePrivacyMode);
  const userName = useSettingsStore((s) => s.userName);

  const heading = title ?? `${greeting()}${userName ? `, ${userName}` : ""}`;

  return (
    <View style={styles.row}>
      <View style={styles.textColumn}>
        <Text style={[typography.h1, { color: colors.textPrimary }]} numberOfLines={1}>
          {heading}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {showPrivacyToggle ? (
        <IconButton
          name={privacyMode ? "eye-off-outline" : "eye-outline"}
          onPress={() => togglePrivacyMode()}
          accessibilityLabel={privacyMode ? "Bedragen tonen" : "Bedragen verbergen"}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  textColumn: { flex: 1, marginRight: spacing.sm },
});
