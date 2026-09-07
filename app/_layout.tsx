import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppState, type AppStateStatus, View } from "react-native";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLockScreen } from "@/features/appLock/AppLockScreen";
import { useTheme } from "@/hooks/useTheme";
import { bootstrapApp } from "@/store";
import { useSettingsStore } from "@/store/settingsStore";
import { useMarketDataAutoRefresh } from "@/hooks/useMarketDataAutoRefresh";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { scheme, colors } = useTheme();
  const isLocked = useSettingsStore((s) => s.isLocked);
  const appLockMethod = useSettingsStore((s) => s.appLockMethod);
  const lock = useSettingsStore((s) => s.lock);

  useMarketDataAutoRefresh();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background" && appLockMethod !== "none") {
        lock();
      }
    });
    return () => subscription.remove();
  }, [appLockMethod, lock]);

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
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      {isLocked ? <AppLockScreen /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    bootstrapApp()
      .catch((error) => console.error("Bootstrap mislukt:", error))
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
