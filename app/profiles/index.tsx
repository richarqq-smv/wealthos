import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { PinInput } from "@/components/form/PinInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useTheme } from "@/hooks/useTheme";
import { spacing, radius, touchSize, typography } from "@/constants/theme";
import { useProfileStore } from "@/store/profileStore";

type Step = "pick" | "pin" | "setup-pin" | "forgot-confirm" | "forgot-reset";

export default function ProfilePickerScreen() {
  const { colors } = useTheme();
  const profiles = useProfileStore((s) => s.profiles);
  const login = useProfileStore((s) => s.login);
  const loginDemo = useProfileStore((s) => s.loginDemo);
  const completeProfileSetup = useProfileStore((s) => s.completeProfileSetup);
  const resetPin = useProfileStore((s) => s.resetPin);

  const [step, setStep] = useState<Step>("pick");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [confirmForgot, setConfirmForgot] = useState(false);

  const realProfiles = profiles.filter((p) => !p.isDemo);
  const demoProfile = profiles.find((p) => p.isDemo);
  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const resetLocalState = () => {
    setPin("");
    setError(null);
    setNewPin("");
    setConfirmPin("");
    setSetupError(null);
  };

  const selectProfile = (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    setSelectedId(id);
    resetLocalState();
    setStep(profile?.needsPinSetup ? "setup-pin" : "pin");
  };

  const backToPick = () => {
    setSelectedId(null);
    resetLocalState();
    setStep("pick");
  };

  const submitLogin = async (pinValue: string) => {
    if (!selectedId || busy) return;
    setBusy(true);
    const result = await login(selectedId, pinValue);
    setBusy(false);
    if (!result.ok) {
      if (result.reason === "needs-pin-setup") {
        // The PIN hash is missing even though this profile isn't flagged as
        // needing setup (e.g. secure storage was cleared independently) —
        // route to the PIN-reset flow (no old-PIN check) rather than
        // claiming the PIN itself was wrong, or to a setup step that would
        // reject this profile for not being flagged needsPinSetup.
        resetLocalState();
        setStep("forgot-reset");
        return;
      }
      setError("Onjuiste PIN. Probeer opnieuw.");
      setPin("");
    }
  };

  const handlePinChange = (next: string) => {
    setPin(next);
    setError(null);
    if (next.length === 4) submitLogin(next);
  };

  const submitNewPin = async () => {
    if (newPin.length !== 4) {
      setSetupError("Vul een 4-cijferige PIN in.");
      return;
    }
    if (newPin !== confirmPin) {
      setSetupError("De PIN-codes komen niet overeen.");
      setConfirmPin("");
      return;
    }
    if (!selectedId) return;
    setBusy(true);
    if (step === "forgot-reset") {
      const result = await resetPin(selectedId, newPin);
      setBusy(false);
      if (!result.ok) {
        setSetupError("Ongeldige PIN.");
        return;
      }
      backToPick();
      return;
    }
    const result = await completeProfileSetup(selectedId, newPin);
    setBusy(false);
    if (!result.ok) {
      setSetupError("Ongeldige PIN.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.iconCircle, { backgroundColor: colors.accentMuted }]}>
        <Ionicons name="trending-up" size={28} color={colors.accent} />
      </View>
      <Text style={[typography.display, { color: colors.textPrimary, marginBottom: spacing.xxl }]}>WealthOS</Text>

      {step === "pick" ? (
        <View style={styles.panel}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md, textAlign: "center" }]}>
            Wie gebruikt WealthOS?
          </Text>

          {realProfiles.length === 0 ? (
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg }]}>
              Nog geen lokale gebruikers op deze computer.
            </Text>
          ) : (
            <View style={styles.list}>
              {realProfiles.map((profile) => (
                <Pressable
                  key={profile.id}
                  onPress={() => selectProfile(profile.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.profileRow,
                    { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.accentMuted }]}>
                    <Text style={[typography.bodyMedium, { color: colors.accent }]}>
                      {profile.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{profile.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <PrimaryButton label="+ Nieuwe gebruiker" onPress={() => router.push("/profiles/create")} />
            {demoProfile ? (
              <SecondaryButton
                label="Demo gebruiken"
                onPress={async () => {
                  setBusy(true);
                  await loginDemo();
                  setBusy(false);
                }}
                disabled={busy}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {step === "pin" && selected ? (
        <View style={styles.panel}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.lg, textAlign: "center" }]}>
            Welkom terug, {selected.name}
          </Text>
          <PinInput value={pin} onChange={handlePinChange} error={!!error} onSubmit={() => submitLogin(pin)} />
          {error ? (
            <Text style={[typography.caption, { color: colors.negative, marginTop: spacing.sm }]}>{error}</Text>
          ) : null}
          <View style={styles.linkRow}>
            <Pressable onPress={backToPick} accessibilityRole="button">
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Ander profiel</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmForgot(true)} accessibilityRole="button">
              <Text style={[typography.caption, { color: colors.accent }]}>PIN vergeten?</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === "setup-pin" || step === "forgot-reset" ? (
        <View style={styles.panel}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.xs, textAlign: "center" }]}>
            {step === "forgot-reset" ? "Nieuwe PIN instellen" : "Stel een PIN in voor dit profiel"}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.lg, textAlign: "center" }]}>
            Je financiële gegevens blijven volledig behouden.
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Nieuwe PIN</Text>
          <PinInput value={newPin} onChange={(v) => { setNewPin(v); setSetupError(null); }} showKeypad={false} />
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.lg }]}>Bevestig PIN</Text>
          <PinInput
            value={confirmPin}
            onChange={(v) => { setConfirmPin(v); setSetupError(null); }}
            showKeypad
            autoFocus={false}
            onSubmit={submitNewPin}
          />
          {setupError ? (
            <Text style={[typography.caption, { color: colors.negative, marginTop: spacing.sm }]}>{setupError}</Text>
          ) : null}
          <View style={{ marginTop: spacing.lg, width: "100%" }}>
            <PrimaryButton label="PIN opslaan" onPress={submitNewPin} loading={busy} />
          </View>
          <Pressable onPress={backToPick} accessibilityRole="button" style={{ marginTop: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Annuleren</Text>
          </Pressable>
        </View>
      ) : null}

      <ConfirmationModal
        visible={confirmForgot}
        title="PIN resetten?"
        message="Je kunt hier een nieuwe PIN instellen voor dit profiel. Je rekeningen, transacties en beleggingen blijven volledig behouden — alleen de PIN wordt vervangen."
        confirmLabel="Nieuwe PIN instellen"
        onConfirm={() => {
          setConfirmForgot(false);
          resetLocalState();
          setStep("forgot-reset");
        }}
        onCancel={() => setConfirmForgot(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  panel: { width: "100%", maxWidth: 360, alignItems: "center" },
  list: { width: "100%", gap: spacing.sm, marginBottom: spacing.lg },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchSize.min,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actions: { width: "100%", gap: spacing.sm },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
});
