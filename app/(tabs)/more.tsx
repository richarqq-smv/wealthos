import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: Parameters<typeof router.push>[0];
}

const ITEMS: MenuItem[] = [
  { icon: "bar-chart-outline", label: "Analyse", route: "/analytics" },
  { icon: "pie-chart-outline", label: "Budgetten", route: "/budget" },
  { icon: "document-text-outline", label: "Schulden", route: "/liability" },
  { icon: "settings-outline", label: "Instellingen", route: "/settings" },
];

export default function MoreScreen() {
  const { colors } = useTheme();
  const demoModeActive = useSettingsStore((s) => s.demoModeActive);

  return (
    <ScreenContainer>
      <AppHeader title="Meer" />

      {demoModeActive ? (
        <Card style={styles.demoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
          <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
            Demo-modus actief — je bekijkt voorbeelddata.
          </Text>
        </Card>
      ) : null}

      <Card padded={false}>
        {ITEMS.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.route)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index < ITEMS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheetHairline },
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </Card>
    </ScreenContainer>
  );
}

const StyleSheetHairline = 0.5;

const styles = StyleSheet.create({
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
  },
});
