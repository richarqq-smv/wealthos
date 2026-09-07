import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, touchSize, typography } from "@/constants/theme";

interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: Parameters<typeof router.push>[0];
}

const ACTIONS: QuickAction[] = [
  { icon: "add-circle-outline", label: "Rekening", route: "/account/add" },
  { icon: "trending-up-outline", label: "Belegging", route: "/investment/add" },
  { icon: "swap-vertical-outline", label: "Transactie", route: "/transaction/add" },
  { icon: "pie-chart-outline", label: "Budget", route: "/budget/add" },
];

export function QuickActions() {
  const { colors } = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => router.push(action.route)}
          accessibilityRole="button"
          accessibilityLabel={`${action.label} toevoegen`}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name={action.icon} size={18} color={colors.accent} />
          <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "600" }]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: spacing.xxs },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
