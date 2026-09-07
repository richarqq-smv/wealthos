import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, touchSize, typography } from "@/constants/theme";
import { FieldWrapper } from "./form/FieldLabel";
import { BottomSheet } from "./BottomSheet";
import { TextField } from "./form/TextField";
import { MarketDataService } from "@/services/market/MarketDataService";
import type { SymbolSearchResult } from "@/types/marketData";

interface SymbolSearchFieldProps {
  label: string;
  placeholder?: string;
  onSelect: (result: SymbolSearchResult) => void;
}

const SEARCH_DEBOUNCE_MS = 400;

export function SymbolSearchField({ label, placeholder, onSelect }: SymbolSearchFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setSearched(false);
      try {
        const matches = await MarketDataService.searchSymbol(query);
        setResults(matches);
      } finally {
        setIsSearching(false);
        setSearched(true);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  return (
    <FieldWrapper label={label}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.field, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      >
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <Text style={[typography.body, { color: colors.textTertiary }]}>
          {placeholder ?? "Zoek op ticker of naam..."}
        </Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>{label}</Text>
        <TextField
          label="Zoeken"
          value={query}
          onChangeText={setQuery}
          placeholder="Bijv. AAPL of Apple"
          autoCapitalize="none"
        />

        {isSearching ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
        ) : (
          <ScrollView style={styles.results}>
            {results.map((result) => (
              <Pressable
                key={`${result.providerSymbol}:${result.exchange}`}
                onPress={() => {
                  onSelect(result);
                  setOpen(false);
                  setQuery("");
                  setResults([]);
                }}
                style={[styles.option, { borderBottomColor: colors.border }]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.textPrimary }]}>{result.symbol}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                    {result.name} · {result.exchange}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
            {searched && !isSearching && results.length === 0 ? (
              <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                Geen resultaten. Vul de gegevens hieronder handmatig in, of controleer je live-marktdata-instellingen.
              </Text>
            ) : null}
          </ScrollView>
        )}
      </BottomSheet>
    </FieldWrapper>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: touchSize.min,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  results: { maxHeight: 320 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
