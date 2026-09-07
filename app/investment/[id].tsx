import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { MoneyText } from "@/components/MoneyText";
import { PercentageText } from "@/components/PercentageText";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { BottomSheet } from "@/components/BottomSheet";
import { TextField } from "@/components/form/TextField";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { DateField } from "@/components/form/DateField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { DataOriginBadge } from "@/components/DataOriginBadge";
import { IconButton } from "@/components/IconButton";
import { LiveDataBadge } from "@/components/LiveDataBadge";
import { FilterChips } from "@/components/FilterChips";
import { PortfolioChart } from "@/components/PortfolioChart";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useMarketDataStore } from "@/store/marketDataStore";
import { MarketDataService, investmentAssetType } from "@/services/market/MarketDataService";
import { marketDataInstrumentKey } from "@/types/marketData";
import type { CompanyProfile, DividendInfo, HistoricalPeriod, HistoricalSeries } from "@/types/marketData";
import type { HistoricalResult } from "@/services/market/MarketDataService";
import { deriveLiveStatus, EMPTY_REFRESH_STATUS } from "@/lib/marketData/liveStatus";
import {
  calculateInvestedCapital,
  calculateInvestmentValue,
  calculatePortfolioValue,
  calculateProfitLoss,
  calculateReturnPercentage,
} from "@/lib/calculations";
import { formatDateShort, nowISO } from "@/utils/date";
import { INVESTMENT_TYPE_LABEL } from "@/constants/categories";

const HISTORY_PERIOD_OPTIONS: { value: HistoricalPeriod; label: string }[] = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "5D" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "1Y", label: "1J" },
  { value: "MAX", label: "MAX" },
];

export default function InvestmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const investments = useInvestmentsStore((s) => s.investments);
  const getTransactionsFor = useInvestmentsStore((s) => s.getTransactionsFor);
  const recordPurchase = useInvestmentsStore((s) => s.recordPurchase);
  const recordSale = useInvestmentsStore((s) => s.recordSale);
  const editInvestment = useInvestmentsStore((s) => s.editInvestment);
  const removeInvestment = useInvestmentsStore((s) => s.removeInvestment);

  const investment = investments.find((i) => i.id === id);
  const transactions = getTransactionsFor(id ?? "");

  const [sheet, setSheet] = useState<"buy" | "sell" | null>(null);
  const [tradeQuantity, setTradeQuantity] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeDate, setTradeDate] = useState(nowISO());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(
    investment ? String(investment.currentPriceMinor / 100).replace(".", ",") : ""
  );
  const [broker, setBroker] = useState(investment?.broker ?? "");

  const marketData = useSettingsStore((s) => s.marketData);
  const refreshOne = useMarketDataStore((s) => s.refreshOne);
  const isRefreshingMarket = useMarketDataStore((s) => s.isRefreshing);

  const [period, setPeriod] = useState<HistoricalPeriod>("3M");
  const [history, setHistory] = useState<HistoricalSeries | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [dividend, setDividend] = useState<DividendInfo | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  const showLiveData = Boolean(investment?.liveDataEnabled && investment?.providerSymbol);

  const instrumentKey = investment
    ? marketDataInstrumentKey(investment.providerSymbol ?? investment.id, investment.exchange)
    : "";
  const instrumentStatus = useMarketDataStore((s) => s.statusByInstrument[instrumentKey]) ?? EMPTY_REFRESH_STATUS;
  const liveStatus = investment
    ? deriveLiveStatus(investmentAssetType(investment), instrumentStatus, marketData.enabled)
    : "offline";

  useEffect(() => {
    if (!investment || !showLiveData || !marketData.assetToggles.historical || !investment.providerSymbol) {
      setHistory(null);
      setHistoryError(null);
      return;
    }
    let cancelled = false;
    setIsLoadingHistory(true);
    setHistoryError(null);
    MarketDataService.getHistoricalForSymbol(
      investment.providerSymbol,
      investmentAssetType(investment),
      period,
      investment.exchange
    )
      .then((result: HistoricalResult) => {
        if (cancelled) return;
        if (result.ok) {
          setHistory(result.series);
        } else {
          setHistory(null);
          setHistoryError(
            result.reason === "noApiKey"
              ? null // not an error — historical is simply off, EmptyState already covers this via showLiveData
              : result.reason === "rateLimited"
                ? "Limiet bereikt, probeer later opnieuw."
                : "Kon historische koersdata niet ophalen."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investment?.id, showLiveData, period, marketData.assetToggles.historical]);

  useEffect(() => {
    if (!investment || !showLiveData || !marketData.assetToggles.dividend) {
      setDividend(null);
      return;
    }
    let cancelled = false;
    MarketDataService.getDividend(investment).then((info) => {
      if (!cancelled) setDividend(info);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investment?.id, showLiveData, marketData.assetToggles.dividend]);

  useEffect(() => {
    if (!investment || !showLiveData || !marketData.assetToggles.companyInfo) {
      setCompanyProfile(null);
      return;
    }
    let cancelled = false;
    MarketDataService.getCompanyProfile(investment).then((profile) => {
      if (!cancelled) setCompanyProfile(profile);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investment?.id, showLiveData, marketData.assetToggles.companyInfo]);

  const portfolioValue = calculatePortfolioValue(investments);

  if (!investment) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Belegging" }} />
        <EmptyState icon="alert-circle-outline" title="Belegging niet gevonden" description="Deze belegging bestaat niet meer." />
      </ScreenContainer>
    );
  }

  const currentValue = calculateInvestmentValue(investment);
  const invested = calculateInvestedCapital(investment);
  const profitLoss = calculateProfitLoss(currentValue, invested);
  const returnPct = calculateReturnPercentage(invested, profitLoss);
  const portfolioShare = portfolioValue === 0 ? 0 : currentValue / portfolioValue;

  const openSheet = (mode: "buy" | "sell") => {
    setTradeQuantity("");
    setTradePrice(String(investment.currentPriceMinor / 100).replace(".", ","));
    setTradeDate(nowISO());
    setSheet(mode);
  };

  const submitTrade = async () => {
    const quantityValue = Number.parseFloat(tradeQuantity.replace(",", "."));
    if (!quantityValue || quantityValue <= 0) return;
    const priceMinor = parseMoneyInputToMinor(tradePrice || "0");
    if (sheet === "buy") {
      await recordPurchase(investment.id, { quantity: quantityValue, priceMinor, date: tradeDate });
    } else if (sheet === "sell") {
      await recordSale(investment.id, { quantity: quantityValue, priceMinor, date: tradeDate });
    }
    setSheet(null);
  };

  const saveEdit = async () => {
    await editInvestment(investment.id, {
      currentPriceMinor: parseMoneyInputToMinor(currentPrice || "0"),
      broker: broker.trim(),
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await removeInvestment(investment.id);
    setConfirmDelete(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `${investment.name} (${investment.ticker})`,
          headerRight: () =>
            isEditing ? null : (
              <IconButton name="create-outline" onPress={() => setIsEditing(true)} accessibilityLabel="Bewerken" />
            ),
        }}
      />

      {isEditing ? (
        <View style={styles.form}>
          <MoneyField label="Huidige prijs" value={currentPrice} onChangeText={setCurrentPrice} />
          <TextField label="Broker" value={broker} onChangeText={setBroker} />
          <View style={styles.editActions}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Annuleren" onPress={() => setIsEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Opslaan" onPress={saveEdit} />
            </View>
          </View>
        </View>
      ) : (
        <>
          <Card style={styles.headerCard}>
            <View style={styles.badgeRow}>
              <DataOriginBadge origin={investment.origin} />
              {showLiveData ? (
                <View style={styles.liveDataRow}>
                  <LiveDataBadge
                    status={liveStatus}
                    timestamp={instrumentStatus.lastSuccessAt}
                    errorKind={instrumentStatus.lastErrorKind}
                  />
                  <IconButton
                    name="refresh"
                    onPress={() => {
                      if (!isRefreshingMarket) refreshOne(investment);
                    }}
                    accessibilityLabel="Koers verversen"
                  />
                </View>
              ) : null}
            </View>
            <MoneyText minor={currentValue} variant="display" style={{ marginTop: spacing.xs }} />
            <View style={styles.changeRow}>
              <MoneyText minor={profitLoss} signed variant="body" />
              <PercentageText fraction={returnPct} />
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {INVESTMENT_TYPE_LABEL[investment.type]} · {investment.broker || "Onbekende broker"}
            </Text>
          </Card>

          <Card style={styles.metricsCard}>
            <MetricRow label="Aantal" value={`${investment.quantity}`} />
            <MetricRow label="Gemiddelde aankoopprijs" value={<MoneyText minor={investment.averagePriceMinor} />} />
            <MetricRow label="Huidige prijs" value={<MoneyText minor={investment.currentPriceMinor} />} />
            <MetricRow label="Geïnvesteerd" value={<MoneyText minor={invested} />} />
            <MetricRow label="Huidige waarde" value={<MoneyText minor={currentValue} />} />
            <MetricRow label="Portefeuille aandeel" value={`${(portfolioShare * 100).toFixed(1)}%`} last />
          </Card>

          <View style={styles.actionsRow}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Verkopen" onPress={() => openSheet("sell")} disabled={investment.quantity <= 0} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Bijkopen" onPress={() => openSheet("buy")} />
            </View>
          </View>

          {showLiveData && marketData.assetToggles.historical ? (
            <Card style={styles.section}>
              <View style={styles.periodRow}>
                <FilterChips options={HISTORY_PERIOD_OPTIONS} value={period} onChange={setPeriod} />
              </View>
              {isLoadingHistory ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
              ) : historyError ? (
                <Text style={[typography.caption, { color: colors.negative, paddingVertical: spacing.md }]}>
                  {historyError}
                </Text>
              ) : history && history.points.length > 1 ? (
                <PortfolioChart
                  points={history.points.map((p) => ({ date: p.date, valueMinor: p.closeMinor }))}
                  currency={history.currency}
                  showAxisLabels
                />
              ) : (
                <Text style={[typography.caption, { color: colors.textTertiary, paddingVertical: spacing.md }]}>
                  Geen historische koersdata beschikbaar.
                </Text>
              )}
            </Card>
          ) : null}

          {showLiveData && marketData.assetToggles.dividend && dividend ? (
            <Card style={styles.section}>
              <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Dividend</Text>
              <MetricRow
                label="Dividend per aandeel"
                value={
                  dividend.dividendPerShareMinor !== null ? (
                    <MoneyText minor={dividend.dividendPerShareMinor} />
                  ) : (
                    "Onbekend"
                  )
                }
              />
              <MetricRow
                label="Dividendrendement"
                value={dividend.dividendYield !== null ? `${dividend.dividendYield.toFixed(2)}%` : "Onbekend"}
              />
              <MetricRow
                label="Ex-dividenddatum"
                value={dividend.exDividendDate ? formatDateShort(dividend.exDividendDate) : "Onbekend"}
                last
              />
            </Card>
          ) : null}

          {showLiveData && marketData.assetToggles.companyInfo && companyProfile ? (
            <Card style={styles.section}>
              <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Bedrijfsinformatie
              </Text>
              {companyProfile.sector ? <MetricRow label="Sector" value={companyProfile.sector} /> : null}
              {companyProfile.industry ? <MetricRow label="Industrie" value={companyProfile.industry} /> : null}
              {companyProfile.country ? <MetricRow label="Land" value={companyProfile.country} /> : null}
              {companyProfile.website ? <MetricRow label="Website" value={companyProfile.website} last /> : null}
              {companyProfile.description ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                  {companyProfile.description}
                </Text>
              ) : null}
            </Card>
          ) : null}

          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
            Transacties
          </Text>
          {transactions.length === 0 ? (
            <EmptyState icon="swap-vertical-outline" title="Nog geen transacties" description="Er zijn nog geen aan- of verkopen geregistreerd." />
          ) : (
            <Card>
              {transactions.map((t) => (
                <View key={t.id} style={[styles.tradeRow, { borderBottomColor: colors.border }]}>
                  <View>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                      {t.type === "buy" ? "Aankoop" : "Verkoop"}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      {formatDateShort(t.date)} · {t.quantity} stuks
                    </Text>
                  </View>
                  <MoneyText minor={Math.round(t.quantity * t.priceMinor)} variant="body" />
                </View>
              ))}
            </Card>
          )}

          <View style={styles.deleteButton}>
            <SecondaryButton label="Belegging verwijderen" onPress={() => setConfirmDelete(true)} />
          </View>
        </>
      )}

      <BottomSheet visible={sheet !== null} onClose={() => setSheet(null)}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          {sheet === "buy" ? "Aankoop registreren" : "Verkoop registreren"}
        </Text>
        <TextField label="Aantal" value={tradeQuantity} onChangeText={setTradeQuantity} keyboardType="decimal-pad" />
        <MoneyField label="Prijs per stuk" value={tradePrice} onChangeText={setTradePrice} />
        <DateField label="Datum" value={tradeDate} onChange={setTradeDate} />
        <PrimaryButton label="Opslaan" onPress={submitTrade} />
      </BottomSheet>

      <ConfirmationModal
        visible={confirmDelete}
        title="Belegging verwijderen?"
        message="Deze actie kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScreenContainer>
  );
}

function MetricRow({ label, value, last = false }: { label: string; value: React.ReactNode; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.metricRow,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
      {typeof value === "string" ? (
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md },
  editActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  headerCard: { marginBottom: spacing.md },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveDataRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  changeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xxs },
  metricsCard: { marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  periodRow: { marginBottom: spacing.sm },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  tradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deleteButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
