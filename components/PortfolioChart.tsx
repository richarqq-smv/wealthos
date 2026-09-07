import { useMemo, useState } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { usePrivacyFormat } from "@/hooks/usePrivacyFormat";
import { formatDateMedium } from "@/utils/date";
import type { CurrencyCode } from "@/types/models";

export interface ChartPoint {
  date: string;
  valueMinor: number;
}

interface PortfolioChartProps {
  points: ChartPoint[];
  height?: number;
  /** Overrides the user's base currency — an instrument's own chart (e.g. a USD NASDAQ listing) must show its own currency, not silently reformat into the portfolio's base one. */
  currency?: CurrencyCode | string;
  /** Renders min/max price labels on the y-axis and first/last date on the x-axis. */
  showAxisLabels?: boolean;
}

const PADDING_X = 4;
const PADDING_Y = 12;

export function PortfolioChart({ points, height = 180, currency, showAxisLabels = false }: PortfolioChartProps) {
  const { colors } = useTheme();
  const { money } = usePrivacyFormat();
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const currencyOption = currency ? { currency: currency as CurrencyCode } : undefined;

  const { path, areaPath, coords } = useMemo(() => {
    if (points.length < 2 || width === 0) {
      return { path: "", areaPath: "", coords: [] as { x: number; y: number }[] };
    }
    const values = points.map((p) => p.valueMinor);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const usableWidth = width - PADDING_X * 2;
    const usableHeight = height - PADDING_Y * 2;

    const points2d = points.map((p, index) => {
      const x = PADDING_X + (index / (points.length - 1)) * usableWidth;
      const y = PADDING_Y + usableHeight - ((p.valueMinor - min) / range) * usableHeight;
      return { x, y };
    });

    const linePath = points2d.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const area = `${linePath} L ${points2d[points2d.length - 1]?.x ?? 0} ${height} L ${points2d[0]?.x ?? 0} ${height} Z`;

    return { path: linePath, areaPath: area, coords: points2d };
  }, [points, width, height]);

  const handleTouch = (event: GestureResponderEvent) => {
    if (coords.length === 0) return;
    const x = event.nativeEvent.locationX;
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    coords.forEach((c, index) => {
      const distance = Math.abs(c.x - x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });
    setActiveIndex(closest);
  };

  const active = activeIndex !== null ? points[activeIndex] : points[points.length - 1];
  const activeCoord = activeIndex !== null ? coords[activeIndex] : coords[coords.length - 1];

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>
          Nog niet genoeg data voor een grafiek.
        </Text>
      </View>
    );
  }

  const values = points.map((p) => p.valueMinor);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  return (
    <View>
      <View style={styles.header}>
        <Text style={[typography.h3, { color: colors.textPrimary }]}>
          {active ? money(active.valueMinor, currencyOption) : ""}
        </Text>
        {active ? (
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {formatDateMedium(active.date)}
          </Text>
        ) : null}
      </View>
      <View
        style={{ height }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={() => setActiveIndex(null)}
      >
        {showAxisLabels ? (
          <>
            <Text style={[typography.micro, styles.priceAxisTop, { color: colors.textTertiary }]}>
              {money(maxValue, currencyOption)}
            </Text>
            <Text style={[typography.micro, styles.priceAxisBottom, { color: colors.textTertiary }]}>
              {money(minValue, currencyOption)}
            </Text>
          </>
        ) : null}
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.chartLine} stopOpacity={0.25} />
                <Stop offset="1" stopColor={colors.chartLine} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#areaFill)" />
            <Path d={path} stroke={colors.chartLine} strokeWidth={2.5} fill="none" />
            {activeCoord ? (
              <>
                <Line
                  x1={activeCoord.x}
                  y1={0}
                  x2={activeCoord.x}
                  y2={height}
                  stroke={colors.chartGrid}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <Circle cx={activeCoord.x} cy={activeCoord.y} r={5} fill={colors.chartLine} />
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>
      {showAxisLabels ? (
        <View style={styles.dateAxis}>
          <Text style={[typography.micro, { color: colors.textTertiary }]}>{formatDateMedium(points[0]!.date)}</Text>
          <Text style={[typography.micro, { color: colors.textTertiary }]}>
            {formatDateMedium(points[points.length - 1]!.date)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xs },
  empty: { alignItems: "center", justifyContent: "center" },
  priceAxisTop: { position: "absolute", top: 0, left: 0, zIndex: 1 },
  priceAxisBottom: { position: "absolute", bottom: 0, left: 0, zIndex: 1 },
  dateAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xxs },
});
