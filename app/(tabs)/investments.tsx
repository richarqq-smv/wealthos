import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { MarketDataStatusBar } from "@/components/MarketDataStatusBar";
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
  const { snapshots } = usePortfolioSnapshots();
  const [period, setPeriod] = useState<PeriodKey>("3M");
  const [typeFilter, setTypeFilter] = useState<InvestmentType | "alle">("alle");
  const [sort, setSort] = useState<SortKey>("value-desc");

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

  const visibleInvestments = useMemo(() => {
    let list = investments;
    if (typeFilter !== "alle") {
      list = list.filter((i) => i.type === typeFilter);
    }
    const withMetrics = list.map((investment) => {
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
  }, [investments, typeFilter, sort]);

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

      {visibleInvestments.length === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          title="Nog geen beleggingen"
          description="Voeg je eerste belegging toe om je portefeuille te volgen."
          actionLabel="Belegging toevoegen"
          onAction={() => router.push("/investment/add")}
        />
      ) : (
        <View style={styles.list}>
          {visibleInvestments.map((investment) => (
            <InvestmentCard key={investment.id} investment={investment} />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryCard: { marginBottom: spacing.md },
  changeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xxs },
  periodRow: { marginTop: spacing.md, marginBottom: spacing.xs },
  section: { marginBottom: spacing.md },
  filtersRow: { marginBottom: spacing.sm },
  list: { gap: spacing.xs, paddingBottom: spacing.lg },
});
