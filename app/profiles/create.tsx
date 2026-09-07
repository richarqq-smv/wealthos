import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/form/TextField";
import { PinInput } from "@/components/form/PinInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { spacing, typography } from "@/constants/theme";
import { useProfileStore } from "@/store/profileStore";

export default function CreateProfileScreen() {
  const { colors } = useTheme();
  const createProfile = useProfileStore((s) => s.createProfile);

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setNameError(null);
    setPinError(null);

    if (!name.trim()) {
      setNameError("Vul een naam in.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setPinError("Vul een 4-cijferige PIN in (alleen 0-9).");
      return;
    }
    if (pin !== confirmPin) {
      setPinError("De PIN-codes komen niet overeen.");
      setConfirmPin("");
      return;
    }

    setBusy(true);
    const result = await createProfile(name, pin);
    setBusy(false);

    if (!result.ok) {
      if (result.reason === "duplicate-name") {
        setNameError("Er bestaat al een profiel met deze naam.");
      } else if (result.reason === "invalid-pin") {
        setPinError("Ongeldige PIN.");
      } else {
        setNameError("Vul een naam in.");
      }
      return;
    }
    // On success isAuthenticated flips true — Stack.Protected in
    // app/_layout.tsx makes this route inaccessible and redirects.
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "Nieuwe gebruiker" }} />
      <View style={styles.form}>
        <TextField label="Naam" value={name} onChangeText={setName} placeholder="Bijv. Richard" error={nameError ?? undefined} />

        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Maak een 4-cijferige PIN
        </Text>
        <PinInput value={pin} onChange={(v) => { setPin(v); setPinError(null); }} showKeypad={false} />

        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.lg }]}>
          Bevestig PIN
        </Text>
        <PinInput
          value={confirmPin}
          onChange={(v) => { setConfirmPin(v); setPinError(null); }}
          autoFocus={false}
          onSubmit={handleCreate}
        />

        {pinError ? (
          <Text style={[typography.caption, { color: colors.negative, marginTop: spacing.sm, textAlign: "center" }]}>
            {pinError}
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          <PrimaryButton label="Profiel aanmaken" onPress={handleCreate} loading={busy} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md, alignItems: "center" },
});
