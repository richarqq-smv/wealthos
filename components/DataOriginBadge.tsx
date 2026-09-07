import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, typography } from "@/constants/theme";
import type { DataOrigin } from "@/types/models";

const LABEL: Record<DataOrigin, string> = {
  demo: "Demo",
  manual: "Handmatig",
  synced: "Gesynchroniseerd",
};

export function DataOriginBadge({ origin }: { origin: DataOrigin }) {
  const { colors } = useTheme();
  if (origin === "manual") return null;

  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[typography.micro, { color: colors.textSecondary }]}>{LABEL[origin]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
});
