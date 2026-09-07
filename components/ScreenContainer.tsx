import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/theme";

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

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
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
});
