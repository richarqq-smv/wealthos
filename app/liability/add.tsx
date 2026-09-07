import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/form/TextField";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { spacing } from "@/constants/theme";
import { LIABILITY_TYPE_LABEL } from "@/constants/categories";
import { useLiabilitiesStore } from "@/store/liabilitiesStore";
import type { LiabilityType } from "@/types/models";

const TYPE_OPTIONS = (Object.keys(LIABILITY_TYPE_LABEL) as LiabilityType[]).map((value) => ({
  value,
  label: LIABILITY_TYPE_LABEL[value],
}));

export default function AddLiabilityScreen() {
  const addLiability = useLiabilitiesStore((s) => s.addLiability);
  const [name, setName] = useState("");
  const [type, setType] = useState<LiabilityType>("loan");
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Vul een naam in.");
      return;
    }
    setIsSaving(true);
    try {
      await addLiability({
        name: name.trim(),
        type,
        amountMinor: parseMoneyInputToMinor(amount || "0"),
        interestRate: interestRate ? Number.parseFloat(interestRate.replace(",", ".")) : undefined,
        note: note.trim() || undefined,
      });
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "Schuld toevoegen" }} />
      <View style={styles.form}>
        <TextField label="Naam" value={name} onChangeText={setName} placeholder="Bijv. Hypotheek" error={error} />
        <PickerField label="Type" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <MoneyField label="Bedrag" value={amount} onChangeText={setAmount} />
        <TextField label="Rentepercentage (optioneel)" value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" />
        <TextField label="Notitie (optioneel)" value={note} onChangeText={setNote} multiline />
        <PrimaryButton label="Schuld opslaan" onPress={handleSave} loading={isSaving} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md },
});
