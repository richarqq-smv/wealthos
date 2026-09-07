import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppState, type AppStateStatus, View } from "react-native";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTheme } from "@/hooks/useTheme";
import { useMarketDataAutoRefresh } from "@/hooks/useMarketDataAutoRefresh";
import { useProfileStore } from "@/store/profileStore";

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * `Stack.Protected` (not a plain conditional `<Stack.Screen>` list) is what
 * actually restricts navigation: Expo Router auto-discovers every file-based
 * route regardless of which screens are declared, so a bare `<Stack.Screen>`
 * only customizes options — it never blocks reaching that route by URL or
 * `router.push`. `Stack.Protected` is the real gate, and it applies
 * everywhere a route is reached from — including a route the user was
 * already sitting on when `isAuthenticated` flips (e.g. going to
 * "background" ends the session from any screen, not just the ones that
 * happen to check for it themselves).
 *
 * The profile picker (with its own PIN entry + "PIN vergeten?" recovery) is
 * the app's single front door — it replaces the old separate app-lock/
 * biometric overlay, which had no recovery path at all and could permanently
 * lock a user out (e.g. biometric selected on a machine with no enrolled
 * hardware).
 */
function RootNavigator() {
  const { scheme, colors } = useTheme();
  const isAuthenticated = useProfileStore((s) => s.isAuthenticated);
  const logout = useProfileStore((s) => s.logout);

  useMarketDataAutoRefresh();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background") {
        logout();
      }
    });
    return () => subscription.remove();
  }, [logout]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { color: colors.textPrimary },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="profiles/index" />
          <Stack.Screen name="profiles/create" />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated}>
          {/* (tabs) must be first: when this guard flips to true (login/create),
              navigation lands on the FIRST screen declared here — (tabs)'s own
              layout already redirects to onboarding when it's actually needed,
              so it must be the default, not onboarding/index unconditionally. */}
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="account/add" />
          <Stack.Screen name="account/[id]" />
          <Stack.Screen name="investment/add" />
          <Stack.Screen name="investment/[id]" />
          <Stack.Screen name="transaction/add" />
          <Stack.Screen name="transaction/[id]" />
          <Stack.Screen name="budget/index" />
          <Stack.Screen name="budget/add" />
          <Stack.Screen name="budget/[id]" />
          <Stack.Screen name="liability/index" />
          <Stack.Screen name="liability/add" />
          <Stack.Screen name="liability/[id]" />
          <Stack.Screen name="analytics/index" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/profile" />
          <Stack.Screen name="settings/appearance" />
          <Stack.Screen name="settings/security" />
          <Stack.Screen name="settings/data" />
          <Stack.Screen name="settings/currency" />
          <Stack.Screen name="settings/marketData" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useProfileStore
      .getState()
      .loadProfiles()
      .catch((error) => console.error("Profiel-bootstrap mislukt:", error))
      .finally(() => setIsReady(true));
  }, []);

  const onLayout = useCallback(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
