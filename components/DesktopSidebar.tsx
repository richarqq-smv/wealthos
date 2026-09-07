import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { spacing, radius, typography } from "@/constants/theme";

interface SidebarItem {
  href: "/(tabs)" | "/(tabs)/accounts" | "/(tabs)/investments" | "/(tabs)/transactions" | "/(tabs)/more";
  matchPrefix: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ITEMS: SidebarItem[] = [
  { href: "/(tabs)", matchPrefix: "/", label: "Overzicht", icon: "home-outline" },
  { href: "/(tabs)/accounts", matchPrefix: "/accounts", label: "Rekeningen", icon: "wallet-outline" },
  { href: "/(tabs)/investments", matchPrefix: "/investments", label: "Beleggingen", icon: "trending-up-outline" },
  { href: "/(tabs)/transactions", matchPrefix: "/transactions", label: "Transacties", icon: "swap-vertical-outline" },
  { href: "/(tabs)/more", matchPrefix: "/more", label: "Meer", icon: "menu-outline" },
];

const SIDEBAR_WIDTH = 220;

/** Replaces the bottom tab bar on desktop-width windows — same 5 destinations, just a layout better suited to a wide window. */
export function DesktopSidebar() {
  const { colors } = useTheme();
  const pathname = usePathname();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: colors.accentMuted }]}>
          <Ionicons name="trending-up" size={18} color={colors.accent} />
        </View>
        <Text style={[typography.h3, { color: colors.textPrimary }]}>WealthOS</Text>
      </View>

      <View style={styles.items}>
        {ITEMS.map((item) => {
          const active = item.matchPrefix === "/" ? pathname === "/" : pathname.startsWith(item.matchPrefix);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: active ? colors.accentMuted : pressed ? colors.surfaceMuted : "transparent",
                },
              ]}
            >
              <Ionicons name={item.icon} size={20} color={active ? colors.accent : colors.textSecondary} />
              <Text
                style={[typography.body, { color: active ? colors.accent : colors.textPrimary, fontWeight: active ? "600" : "400" }]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export { SIDEBAR_WIDTH };

const styles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  items: { gap: spacing.xxs },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
});
