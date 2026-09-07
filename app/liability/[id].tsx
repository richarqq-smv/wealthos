import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/form/TextField";
import { MoneyField, parseMoneyInputToMinor } from "@/components/form/MoneyField";
import { PickerField } from "@/components/form/PickerField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { spacing } from "@/constants/theme";
import { LIABILITY_TYPE_LABEL } from "@/constants/categories";
import { useLiabilitiesStore } from "@/store/liabilitiesStore";
import type { LiabilityType } from "@/types/models";

const TYPE_OPTIONS = (Object.keys(LIABILITY_TYPE_LABEL) as LiabilityType[]).map((value) => ({
  value,
  label: LIABILITY_TYPE_LABEL[value],
}));

export default function LiabilityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const liabilities = useLiabilitiesStore((s) => s.liabilities);
  const editLiability = useLiabilitiesStore((s) => s.editLiability);
  const removeLiability = useLiabilitiesStore((s) => s.removeLiability);

  const liability = liabilities.find((l) => l.id === id);
  const [name, setName] = useState(liability?.name ?? "");
  const [type, setType] = useState<LiabilityType>(liability?.type ?? "other");
  const [amount, setAmount] = useState(liability ? String(liability.amountMinor / 100).replace(".", ",") : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!liability) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Schuld" }} />
        <EmptyState icon="alert-circle-outline" title="Schuld niet gevonden" description="Deze schuld bestaat niet meer." />
      </ScreenContainer>
    );
  }

  const save = async () => {
    await editLiability(liability.id, {
      name: name.trim() || liability.name,
      type,
      amountMinor: parseMoneyInputToMinor(amount || "0"),
    });
    router.back();
  };

  const handleDelete = async () => {
    await removeLiability(liability.id);
    setConfirmDelete(false);
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "Schuld bewerken" }} />
      <View style={styles.form}>
        <TextField label="Naam" value={name} onChangeText={setName} />
        <PickerField label="Type" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <MoneyField label="Bedrag" value={amount} onChangeText={setAmount} />
        <PrimaryButton label="Opslaan" onPress={save} />
        <View style={styles.deleteButton}>
          <SecondaryButton label="Schuld verwijderen" onPress={() => setConfirmDelete(true)} />
        </View>
      </View>

      <ConfirmationModal
        visible={confirmDelete}
        title="Schuld verwijderen?"
        message="Deze actie kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: spacing.md, gap: spacing.xs },
  deleteButton: { marginTop: spacing.lg },
});
