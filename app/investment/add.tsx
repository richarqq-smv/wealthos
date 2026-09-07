import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { TextField } from "@/components/form/TextField";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { DateField } from "@/components/form/DateField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SymbolSearchField } from "@/components/SymbolSearchField";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { INVESTMENT_TYPE_LABEL } from "@/constants/categories";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useMarketDataStore } from "@/store/marketDataStore";
import { nowISO } from "@/utils/date";
import type { CurrencyCode, InvestmentType } from "@/types/models";
import type { MarketAssetType, SymbolSearchResult } from "@/types/marketData";

const ASSET_TYPE_TO_INVESTMENT_TYPE: Record<MarketAssetType, InvestmentType> = {
  stock: "stock",
  etf: "etf",
  crypto: "crypto",
  forex: "other",
};

const TYPE_OPTIONS = (Object.keys(INVESTMENT_TYPE_LABEL) as InvestmentType[]).map((value) => ({
  value,
  label: INVESTMENT_TYPE_LABEL[value],
}));

export default function AddInvestmentScreen() {
  const { colors } = useTheme();
  const addInvestment = useInvestmentsStore((s) => s.addInvestment);
  const marketData = useSettingsStore((s) => s.marketData);
  const refreshOne = useMarketDataStore((s) => s.refreshOne);
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<InvestmentType>("stock");
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [broker, setBroker] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(nowISO());
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [exchange, setExchange] = useState<string | undefined>(undefined);
  const [providerSymbol, setProviderSymbol] = useState<string | undefined>(undefined);
  const [liveDataEnabled, setLiveDataEnabled] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const canSearchSymbols = marketData.enabled && marketData.twelveDataConfigured;

  const handleSymbolSelect = (result: SymbolSearchResult) => {
    if (!name.trim()) setName(result.name);
    setTicker(result.symbol);
    setType(ASSET_TYPE_TO_INVESTMENT_TYPE[result.assetType]);
    setCurrency((result.currency as CurrencyCode) || "EUR");
    setExchange(result.exchange);
    setProviderSymbol(result.providerSymbol);
    setLiveDataEnabled(true);
  };

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Vul een naam in.";
    if (!ticker.trim()) nextErrors.ticker = "Vul een ticker in.";
    const quantityValue = Number.parseFloat(quantity.replace(",", "."));
    if (!quantity || Number.isNaN(quantityValue) || quantityValue < 0) {
      nextErrors.quantity = "Het aantal is ongeldig.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    try {
      const created = await addInvestment({
        name: name.trim(),
        ticker: ticker.trim().toUpperCase(),
        type,
        quantity: quantityValue,
        averagePriceMinor: parseMoneyInputToMinor(avgPrice || "0"),
        currentPriceMinor: parseMoneyInputToMinor(currentPrice || avgPrice || "0"),
        currency,
        broker: broker.trim(),
        purchaseDate,
        exchange,
        providerSymbol,
        liveDataEnabled,
      });
      if (liveDataEnabled && providerSymbol) {
        refreshOne(created).catch(() => {});
      }
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "Belegging toevoegen" }} />
      <View style={styles.form}>
        {canSearchSymbols ? (
          <Card style={styles.searchCard}>
            <SymbolSearchField label="Live data koppelen (optioneel)" onSelect={handleSymbolSelect} />
            {liveDataEnabled && providerSymbol ? (
              <Text style={[typography.caption, { color: colors.positive }]}>
                Gekoppeld aan {providerSymbol} ({exchange}) — koers wordt automatisch opgehaald.
              </Text>
            ) : null}
          </Card>
        ) : null}
        <TextField label="Naam" value={name} onChangeText={setName} placeholder="Bijv. Apple" error={errors.name} />
        <TextField label="Ticker" value={ticker} onChangeText={setTicker} placeholder="Bijv. AAPL" autoCapitalize="characters" error={errors.ticker} />
        <PickerField label="Type" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <TextField label="Aantal" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" error={errors.quantity} />
        <MoneyField label="Gemiddelde aankoopprijs" value={avgPrice} onChangeText={setAvgPrice} />
        <MoneyField label="Huidige prijs" value={currentPrice} onChangeText={setCurrentPrice} />
        <TextField label="Broker" value={broker} onChangeText={setBroker} placeholder="Bijv. DEGIRO" />
        <DateField label="Aankoopdatum" value={purchaseDate} onChange={setPurchaseDate} />
        <PrimaryButton label="Belegging opslaan" onPress={handleSave} loading={isSaving} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md },
  searchCard: { marginBottom: spacing.md, gap: spacing.xs },
});
