import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/form/TextField";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { spacing } from "@/constants/theme";
import { ACCOUNT_TYPE_LABEL } from "@/constants/categories";
import { useAccountsStore } from "@/store/accountsStore";
import type { AccountType } from "@/types/models";

const TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((value) => ({
  value,
  label: ACCOUNT_TYPE_LABEL[value],
}));

export default function AddAccountScreen() {
  const addAccount = useAccountsStore((s) => s.addAccount);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [balance, setBalance] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ name?: string; balance?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Vul een naam in.";
    const balanceMinor = parseMoneyInputToMinor(balance || "0");
    if (balance && Number.isNaN(Number.parseFloat(balance.replace(",", ".")))) {
      nextErrors.balance = "Het bedrag is ongeldig.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    try {
      await addAccount({
        name: name.trim(),
        institution: institution.trim(),
        type,
        balanceMinor,
        currency: "EUR",
        note: note.trim() || undefined,
      });
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "Rekening toevoegen" }} />
      <View style={styles.form}>
        <TextField label="Naam" value={name} onChangeText={setName} placeholder="Bijv. ING Betaalrekening" error={errors.name} />
        <TextField label="Bank / instituut" value={institution} onChangeText={setInstitution} placeholder="Bijv. ING" />
        <PickerField label="Type" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <MoneyField label="Saldo" value={balance} onChangeText={setBalance} error={errors.balance} />
        <TextField label="Notitie (optioneel)" value={note} onChangeText={setNote} multiline />
        <PrimaryButton label="Rekening opslaan" onPress={handleSave} loading={isSaving} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md },
});
