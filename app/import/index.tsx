import { StyleSheet, Text, View } from "react-native";
import { router, Stack, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { SecondaryButton } from "@/components/SecondaryButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import type { BrokerId } from "@/types/models";

interface BrokerOption {
  id: BrokerId;
  name: string;
  description: string;
  available: boolean;
}

const BROKERS: BrokerOption[] = [
  { id: "revolut", name: "Revolut", description: "Volledige historische import: huidige en gesloten posities, dividenden, kosten.", available: true },
  { id: "degiro", name: "DEGIRO", description: "Architectuur klaar — nog niet getest tegen een echte DEGIRO-export.", available: false },
];

export default function ImportHubScreen() {
  const { colors } = useTheme();

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Importeren" }} />
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        Importeer je volledige beleggingsgeschiedenis rechtstreeks vanuit je broker. Parsing gebeurt volledig lokaal — er wordt niets naar
        externe diensten gestuurd.
      </Text>

      {BROKERS.map((broker) => (
        <Card key={broker.id} style={styles.card}>
          <View style={styles.headerRow}>
            <Ionicons name="briefcase-outline" size={20} color={colors.textSecondary} />
            <Text style={[typography.h3, { color: colors.textPrimary, flex: 1 }]}>{broker.name}</Text>
            {!broker.available ? (
              <View style={[styles.badge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[typography.micro, { color: colors.textTertiary }]}>Binnenkort</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs, marginBottom: spacing.sm }]}>
            {broker.description}
          </Text>
          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <SecondaryButton
                label="Stappenplan"
                onPress={() => router.push(`/guides/${broker.id === "revolut" ? "revolut" : "apiSetup"}` as Href)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Importeren"
                onPress={() => router.push(`/import/${broker.id}` as Href)}
                disabled={!broker.available}
              />
            </View>
          </View>
        </Card>
      ))}

      <Card style={styles.historyCard}>
        <View style={styles.headerRow}>
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
          <Text style={[typography.h3, { color: colors.textPrimary, flex: 1 }]}>Importgeschiedenis</Text>
        </View>
        <SecondaryButton label="Bekijken" onPress={() => router.push("/import/history" as Href)} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  historyCard: { marginTop: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: 100, borderWidth: StyleSheet.hairlineWidth },
});
