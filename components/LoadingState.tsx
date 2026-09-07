import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing } from "@/constants/theme";

export function LoadingState() {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

interface SkeletonProps {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: object;
}

export function Skeleton({ height = 16, width = "100%", radius: r = radius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { height, width, borderRadius: r, backgroundColor: colors.skeleton },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <Skeleton height={14} width="40%" style={{ marginBottom: spacing.sm }} />
      <Skeleton height={32} width="70%" style={{ marginBottom: spacing.xs }} />
      <Skeleton height={14} width="50%" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  cardSkeleton: {
    padding: spacing.md,
  },
});
