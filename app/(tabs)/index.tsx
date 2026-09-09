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
import { QuickActions } from "@/components/QuickActions";
import { InvestmentCard } from "@/components/InvestmentCard";
import { TransactionRow } from "@/components/TransactionRow";
import { EmptyState } from "@/components/EmptyState";
import { SecondaryButton } from "@/components/SecondaryButton";
import { LiveDataRefreshControl } from "@/components/LiveDataRefreshControl";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useWealthSummary } from "@/hooks/useWealthSummary";
import { filterSnapshotsByPeriod, usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots";
import { useTransactionsStore } from "@/store/transactionsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useMarketDataStore } from "@/store/marketDataStore";
import { deriveGlobalLiveStatus } from "@/lib/marketData/liveStatus";
import { generateInsights } from "@/features/insights/generateInsights";
import type { PeriodKey } from "@/utils/date";
import { nowISO } from "@/utils/date";

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1J", label: "1J" },
  { value: "ALLES", label: "Alles" },
];

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { tier } = useBreakpoint();
  const isWideDesktop = tier === "wideDesktop";
  const { cashMinor, portfolioMinor, liabilitiesMinor, netWorthMinor, allocation, investments } =
    useWealthSummary();
  const { snapshots } = usePortfolioSnapshots();
  const transactions = useTransactionsStore((s) => s.transactions);
  const marketData = useSettingsStore((s) => s.marketData);
  const marketDataLastError = useMarketDataStore((s) => s.lastError);
  const [period, setPeriod] = useState<PeriodKey>("3M");

  const globalLiveStatus = deriveGlobalLiveStatus({
    enabled: marketData.enabled,
    hasApiKey: marketData.twelveDataConfigured,
    lastSuccessfulUpdate: marketData.lastSuccessfulUpdate,
    lastError: marketDataLastError,
  });

  const chartPoints = useMemo(() => {
    const filtered = filterSnapshotsByPeriod(snapshots, period);
    const points = filtered.map((s) => ({ date: s.date, valueMinor: s.netWorthMinor }));
    if (points.length > 0) {
      points[points.length - 1] = { date: nowISO(), valueMinor: netWorthMinor };
    }
    return points;
  }, [snapshots, period, netWorthMinor]);

  const monthChange = useMemo(() => {
    if (snapshots.length < 2) return { deltaMinor: 0, deltaPct: 0 };
    const previous = snapshots[snapshots.length - 2];
    if (!previous || previous.netWorthMinor === 0) return { deltaMinor: 0, deltaPct: 0 };
    const deltaMinor = netWorthMinor - previous.netWorthMinor;
    return { deltaMinor, deltaPct: deltaMinor / previous.netWorthMinor };
  }, [snapshots, netWorthMinor]);

  const topHoldings = useMemo(
    () =>
      [...investments]
        .sort((a, b) => b.quantity * b.currentPriceMinor - a.quantity * a.currentPriceMinor)
        .slice(0, 4),
    [investments]
  );

  const recentTransactions = transactions.slice(0, 5);
  const insights = useMemo(() => generateInsights(transactions, investments), [transactions, investments]);

  return (
    <ScreenContainer>
      <AppHeader showPrivacyToggle />

      <Card style={styles.netWorthCard}>
        <View style={styles.netWorthHeaderRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Totaal vermogen</Text>
          {marketData.enabled ? (
            <LiveDataRefreshControl status={globalLiveStatus} timestamp={marketData.lastSuccessfulUpdate} errorKind={marketDataLastError} />
          ) : null}
        </View>
        <MoneyText minor={netWorthMinor} variant="display" style={{ marginTop: spacing.xxs }} />
        <View style={styles.changeRow}>
          <MoneyText minor={monthChange.deltaMinor} signed variant="body" />
          <PercentageText fraction={monthChange.deltaPct} />
          <Text style={[typography.caption, { color: colors.textTertiary }]}>deze maand</Text>
        </View>

        <View style={styles.periodRow}>
          <FilterChips options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </View>
        <PortfolioChart points={chartPoints} />
      </Card>

      <View style={styles.summaryRow}>
        <Card onPress={() => router.push("/(tabs)/accounts")} style={styles.summaryCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Cash</Text>
          <MoneyText minor={cashMinor} variant="medium" style={{ marginTop: spacing.xxs }} />
        </Card>
        <Card onPress={() => router.push("/(tabs)/investments")} style={styles.summaryCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Beleggingen</Text>
          <MoneyText minor={portfolioMinor} variant="medium" style={{ marginTop: spacing.xxs }} />
        </Card>
        <Card onPress={() => router.push("/liability")} style={styles.summaryCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Schulden</Text>
          <MoneyText minor={liabilitiesMinor} variant="medium" style={{ marginTop: spacing.xxs }} />
        </Card>
      </View>

      <View style={styles.quickActions}>
        <QuickActions />
      </View>

      {insights.length > 0 ? (
        <Card style={styles.section}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.xs }]}>Jouw maand</Text>
          {insights.map((insight) => (
            <Text key={insight.id} style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.xxs }]}>
              {insight.text}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Waar zit mijn vermogen?
        </Text>
        <AllocationChart slices={allocation} />
      </Card>

      <View style={isWideDesktop ? styles.twoColumnRow : undefined}>
        <View style={isWideDesktop ? styles.twoColumnItem : undefined}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Portefeuille</Text>
            <SecondaryButton
              label="Bekijk portefeuille"
              onPress={() => router.push("/(tabs)/investments")}
              fullWidth={false}
            />
          </View>
          {topHoldings.length === 0 ? (
            <EmptyState
              icon="trending-up-outline"
              title="Nog geen beleggingen"
              description="Voeg je eerste belegging toe om je portefeuille te volgen."
              actionLabel="Belegging toevoegen"
              onAction={() => router.push("/investment/add")}
            />
          ) : (
            <View style={styles.list}>
              {topHoldings.map((investment) => (
                <InvestmentCard key={investment.id} investment={investment} />
              ))}
            </View>
          )}
        </View>

        <View style={isWideDesktop ? styles.twoColumnItem : undefined}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Recente transacties</Text>
            <SecondaryButton
              label="Alle transacties"
              onPress={() => router.push("/(tabs)/transactions")}
              fullWidth={false}
            />
          </View>
          {recentTransactions.length === 0 ? (
            <EmptyState
              icon="swap-vertical-outline"
              title="Nog geen transacties"
              description="Voeg je eerste transactie toe om je geldstromen te volgen."
              actionLabel="Transactie toevoegen"
              onAction={() => router.push("/transaction/add")}
            />
          ) : (
            <Card>
              {recentTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </Card>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  netWorthCard: { marginBottom: spacing.md },
  netWorthHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  changeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xxs },
  periodRow: { marginTop: spacing.md, marginBottom: spacing.xs },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1 },
  quickActions: { marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  twoColumnRow: { flexDirection: "row", gap: spacing.lg },
  twoColumnItem: { flex: 1, minWidth: 0 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.xs, marginBottom: spacing.md },
});
