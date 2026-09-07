import { StyleSheet } from "react-native";
import { Link, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { EmptyState } from "@/components/EmptyState";
import { spacing } from "@/constants/theme";

export default function NotFoundScreen() {
  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: "Niet gevonden" }} />
      <EmptyState
        icon="compass-outline"
        title="Pagina niet gevonden"
        description="Deze pagina bestaat niet (meer)."
      />
      <Link href="/(tabs)" style={styles.link}>
        Terug naar het dashboard
      </Link>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  link: { textAlign: "center", marginTop: spacing.md },
});
