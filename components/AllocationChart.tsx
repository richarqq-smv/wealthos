import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { usePrivacyFormat } from "@/hooks/usePrivacyFormat";
import { formatPercentage } from "@/utils/money";
import type { AllocationSlice } from "@/lib/calculations";

interface AllocationChartProps {
  slices: AllocationSlice[];
  size?: number;
}

const STROKE_WIDTH = 22;

export function AllocationChart({ slices, size = 180 }: AllocationChartProps) {
  const { colors } = useTheme();
  const { moneyCompact } = usePrivacyFormat();
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulative = 0;

  if (slices.length === 0 || slices.every((s) => s.valueMinor === 0)) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.surfaceMuted}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {slices.map((slice, index) => {
            const dash = slice.percentage * circumference;
            const offset = circumference - cumulative;
            cumulative += dash;
            return (
              <Circle
                key={slice.key}
                cx={center}
                cy={center}
                r={radius}
                stroke={colors.allocation[index % colors.allocation.length]}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                fill="none"
                transform={`rotate(-90 ${center} ${center})`}
              />
            );
          })}
        </Svg>
      </View>
      <View style={styles.legend}>
        {slices.map((slice, index) => (
          <View key={slice.key} style={styles.legendRow}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: colors.allocation[index % colors.allocation.length] },
              ]}
            />
            <Text style={[typography.caption, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {moneyCompact(slice.valueMinor)}
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary, width: 44, textAlign: "right" }]}>
              {formatPercentage(slice.percentage, { signed: false })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  legend: { width: "100%", marginTop: spacing.md, gap: spacing.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
