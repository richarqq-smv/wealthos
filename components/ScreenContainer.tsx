import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/theme";
import { contentMaxWidth } from "@/constants/breakpoints";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface ScreenContainerProps {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  contentStyle?: ViewStyle;
  edges?: Array<"top" | "bottom" | "left" | "right">;
}

export function ScreenContainer({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  contentStyle,
  edges = ["top"],
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const { isDesktop } = useBreakpoint();

  // On a wide window, edge-to-edge content just stretches into oversized
  // cards and unreadably long lines — cap width and center, same fix every
  // desktop-aware app makes, without touching any screen's own content.
  const widthLimiter = isDesktop ? styles.desktopWidthLimiter : undefined;

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        ) : undefined
      }
    >
      <View style={widthLimiter}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.flex, isDesktop && styles.centerRow]}>
      <View style={[widthLimiter, styles.flex, contentStyle]}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  scrollContentDesktop: {
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  centerRow: { alignItems: "center" },
  desktopWidthLimiter: { width: "100%", maxWidth: contentMaxWidth },
});
