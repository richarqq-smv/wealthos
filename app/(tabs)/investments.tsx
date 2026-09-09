import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/Card";
import { MoneyText } from "@/components/MoneyText";
import { PercentageText } from "@/components/PercentageText";
import { PortfolioChart } from "@/components/PortfolioChart";
import { AllocationChart } from "@/components/AllocationChart";
import { FilterChips } from "@/components/FilterChips";
import { InvestmentCard } from "@/components/InvestmentCard";
import { ClosedInvestmentRow } from "@/components/ClosedInvestmentRow";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { MarketDataStatusBar } from "@/components/MarketDataStatusBar";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useInvestmentsStore } from "@/store/investmentsStore";
import {
  calculatePortfolioAllocation,
  calculatePortfolioValue,
  calculateProfitLoss,
  calculateReturnPercentage,
  calculateTotalInvestedCapital,
} from "@/lib/calculations";
import { filterSnapshotsByPeriod, usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots";
import type { InvestmentType } from "@/types/models";
import { nowISO, type PeriodKey } from "@/utils/date";

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1J", label: "1J" },
  { value: "ALLES", label: "Alles" },
];

const TYPE_FILTERS: { value: InvestmentType | "alle"; label: string }[] = [
  { value: "alle", label: "Alles" },
  { value: "stock", label: "Aandelen" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" },
  { value: "fund", label: "Fonds" },
  { value: "other", label: "Overig" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "value-desc", label: "Waarde hoog-laag" },
  { value: "return-desc", label: "Rendement hoog-laag" },
  { value: "return-asc", label: "Rendement laag-hoog" },
  { value: "name-asc", label: "Naam A-Z" },
];

type SortKey = "value-desc" | "return-desc" | "return-asc" | "name-asc";

export default function InvestmentsScreen() {
  const { colors } = useTheme();
  const investments = useInvestmentsStore((s) => s.investments);
  const investmentTransactions = useInvestmentsStore((s) => s.investmentTransactions);
  const { snapshots } = usePortfolioSnapshots();
  const [period, setPeriod] = useState<PeriodKey>("3M");
  const [typeFilter, setTypeFilter] = useState<InvestmentType | "alle">("alle");
  const [sort, setSort] = useState<SortKey>("value-desc");
  const [showClosed, setShowClosed] = useState(false);

  const portfolioValue = calculatePortfolioValue(investments);
  const investedCapital = calculateTotalInvestedCapital(investments);
  const profitLoss = calculateProfitLoss(portfolioValue, investedCapital);
  const returnPct = calculateReturnPercentage(investedCapital, profitLoss);
  const allocation = calculatePortfolioAllocation(investments);

  const chartPoints = useMemo(() => {
    const filtered = filterSnapshotsByPeriod(snapshots, period);
    const points = filtered.map((s) => ({ date: s.date, valueMinor: s.investmentsMinor }));
    if (points.length > 0) {
      points[points.length - 1] = { date: nowISO(), valueMinor: portfolioValue };
    }
    return points;
  }, [snapshots, period, portfolioValue]);

  const filteredByType = useMemo(
    () => (typeFilter === "alle" ? investments : investments.filter((i) => i.type === typeFilter)),
    [investments, typeFilter]
  );

  // A fully-sold position (quantity === 0, always live-derived, never trusted
  // from Investment.closedAt alone — see types/models.ts) has nothing
  // meaningful to rank by value or return%, so it's shown in its own
  // "Historische posities" section instead of sinking to the bottom of the
  // current-holdings list looking like a worthless open position.
  const openInvestments = useMemo(() => filteredByType.filter((i) => i.quantity !== 0), [filteredByType]);
  const closedInvestments = useMemo(
    () => filteredByType.filter((i) => i.quantity === 0).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [filteredByType]
  );

  const visibleInvestments = useMemo(() => {
    const withMetrics = openInvestments.map((investment) => {
      const value = investment.quantity * investment.currentPriceMinor;
      const invested = investment.quantity * investment.averagePriceMinor;
      const pl = value - invested;
      return { investment, value, returnPct: calculateReturnPercentage(invested, pl) };
    });
    withMetrics.sort((a, b) => {
      switch (sort) {
        case "value-desc":
          return b.value - a.value;
        case "return-desc":
          return b.returnPct - a.returnPct;
        case "return-asc":
          return a.returnPct - b.returnPct;
        case "name-asc":
          return a.investment.name.localeCompare(b.investment.name);
      }
    });
    return withMetrics.map((w) => w.investment);
  }, [openInvestments, sort]);

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <AppHeader title="Beleggingen" />
        <IconButton name="add-circle-outline" onPress={() => router.push("/investment/add")} accessibilityLabel="Belegging toevoegen" />
      </View>

      <MarketDataStatusBar />

      <Card style={styles.summaryCard}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>Totale portefeuille</Text>
        <MoneyText minor={portfolioValue} variant="display" style={{ marginTop: spacing.xxs }} />
        <View style={styles.changeRow}>
          <MoneyText minor={profitLoss} signed variant="body" />
          <PercentageText fraction={returnPct} />
        </View>
        <View style={styles.periodRow}>
          <FilterChips options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </View>
        <PortfolioChart points={chartPoints} />
      </Card>

      {investments.length > 0 ? (
        <Card style={styles.section}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Portefeuille allocatie
          </Text>
          <AllocationChart slices={allocation} />
        </Card>
      ) : null}

      <View style={styles.filtersRow}>
        <FilterChips options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
      </View>
      <View style={styles.filtersRow}>
        <FilterChips options={SORT_OPTIONS} value={sort} onChange={setSort} />
      </View>

      {visibleInvestments.length === 0 && closedInvestments.length === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          title="Nog geen beleggingen"
          description="Voeg je eerste belegging toe om je portefeuille te volgen."
          actionLabel="Belegging toevoegen"
          onAction={() => router.push("/investment/add")}
        />
      ) : (
        <>
          {visibleInvestments.length > 0 ? (
            <>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Huidige posities</Text>
              <View style={styles.list}>
                {visibleInvestments.map((investment) => (
                  <InvestmentCard key={investment.id} investment={investment} />
                ))}
              </View>
            </>
          ) : (
            <Text style={[typography.caption, { color: colors.textTertiary, marginBottom: spacing.md }]}>
              Geen open posities — bekijk historische posities hieronder.
            </Text>
          )}

          {closedInvestments.length > 0 ? (
            <View style={styles.closedSection}>
              <Pressable
                onPress={() => setShowClosed((v) => !v)}
                accessibilityRole="button"
                style={styles.closedHeader}
              >
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Historische posities (gesloten) · {closedInvestments.length}
                </Text>
                <Ionicons name={showClosed ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} />
              </Pressable>
              {showClosed ? (
                <View style={styles.list}>
                  {closedInvestments.map((investment) => (
                    <ClosedInvestmentRow key={investment.id} investment={investment} transactions={investmentTransactions} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryCard: { marginBottom: spacing.md },
  closedSection: { marginTop: spacing.md },
  closedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.xs },
  changeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xxs },
  periodRow: { marginTop: spacing.md, marginBottom: spacing.xs },
  section: { marginBottom: spacing.md },
  filtersRow: { marginBottom: spacing.sm },
  list: { gap: spacing.xs, paddingBottom: spacing.lg },
});
