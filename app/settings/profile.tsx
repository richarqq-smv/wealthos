import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useTheme } from "@/hooks/useTheme";
import { spacing, touchSize, typography } from "@/constants/theme";
import { useProfileStore } from "@/store/profileStore";

export default function ProfileSettingsScreen() {
  const { colors } = useTheme();
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const logout = useProfileStore((s) => s.logout);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!activeProfile) return null;

  const handleSwitch = () => {
    // Logout returns to the profile picker; the root layout re-renders into
    // the unauthenticated shell automatically once isAuthenticated flips false.
    logout();
  };

  const handleDelete = async () => {
    setBusy(true);
    await deleteProfile(activeProfile.id);
    setBusy(false);
    setConfirmDelete(false);
    // deleteProfile already logs out when the active profile is removed —
    // the root layout takes it from there.
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Profiel" }} />

      <View style={styles.section}>
        <Card>
          <View style={styles.current}>
            <View style={[styles.avatar, { backgroundColor: colors.accentMuted }]}>
              <Text style={[typography.h3, { color: colors.accent }]}>
                {activeProfile.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>{activeProfile.name}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {activeProfile.isDemo ? "Demo-profiel" : "Lokaal profiel"}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: spacing.xs }]}>
        Wisselen
      </Text>
      <Card padded={false}>
        <Pressable
          onPress={handleSwitch}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>Ander profiel kiezen</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
        <Pressable
          onPress={logout}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="person-add-outline" size={20} color={colors.textSecondary} />
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>Nieuwe gebruiker</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <SecondaryButton label="Uitloggen" onPress={handleSwitch} />
      </View>

      {!activeProfile.isDemo ? (
        <View style={{ marginTop: spacing.xxl }}>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: spacing.xs }]}>
            Gevarenzone
          </Text>
          <PrimaryButton label="Profiel verwijderen" onPress={() => setConfirmDelete(true)} destructive />
          <Text style={[typography.micro, { color: colors.textTertiary, marginTop: spacing.xs, marginLeft: spacing.xs }]}>
            Verwijdert dit profiel en al zijn rekeningen, transacties en beleggingen. Andere profielen op deze computer blijven onaangetast.
          </Text>
        </View>
      ) : null}

      <ConfirmationModal
        visible={confirmDelete}
        title="Profiel verwijderen?"
        message={`"${activeProfile.name}" en alle bijbehorende financiële gegevens (rekeningen, transacties, beleggingen) worden permanent verwijderd van deze computer. Dit kan niet ongedaan worden gemaakt.`}
        confirmLabel="Definitief verwijderen"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  current: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
  },
});
