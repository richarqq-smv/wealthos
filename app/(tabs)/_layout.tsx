import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/store/settingsStore";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { DesktopSidebar } from "@/components/DesktopSidebar";

// Auth itself is gated at the root Stack via `Stack.Protected` (app/_layout.tsx)
// — this route never even mounts while unauthenticated. Onboarding is the
// one remaining case handled here, for a migrated pre-0.3.0 profile whose
// old settings had onboardingCompleted: false.
export default function TabsLayout() {
  const { colors } = useTheme();
  const hasLoaded = useSettingsStore((s) => s.hasLoaded);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const { isDesktop } = useBreakpoint();

  if (hasLoaded && !onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  // On a desktop-width window the sidebar replaces the bottom tab bar
  // entirely (same 5 destinations) — the tab bar itself is just hidden, the
  // underlying route structure and navigation are untouched.
  const content = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: isDesktop
          ? { display: "none" }
          : { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overzicht",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Rekeningen",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="investments"
        options={{
          title: "Beleggingen",
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transacties",
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-vertical-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Meer",
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );

  if (!isDesktop) {
    return content;
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
      <DesktopSidebar />
      <View style={{ flex: 1 }}>{content}</View>
    </View>
  );
}
