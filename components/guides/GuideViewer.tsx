import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { spacing, radius, typography } from "@/constants/theme";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import type { Guide } from "@/features/guides/types";

interface GuideViewerProps {
  guide: Guide;
  onDone?: () => void;
}

/**
 * Generic, reusable stepper for any Guide (Revolut download flow, API-key
 * setup, and any future broker's guide) — a new broker only ever needs new
 * data in features/guides/, never a new component.
 */
export function GuideViewer({ guide, onDone }: GuideViewerProps) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const step = guide.steps[index]!;
  const isLast = index === guide.steps.length - 1;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[typography.caption, { color: colors.textTertiary }]}>
        Stap {step.stepNumber} van {guide.steps.length}
      </Text>
      <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xxs }]}>{step.title}</Text>
      {step.description ? (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>{step.description}</Text>
      ) : null}

      <View style={[styles.imageFrame, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
        <Image source={step.image} style={styles.image} resizeMode="contain" accessibilityLabel={step.title} />
      </View>

      {step.note ? (
        <View style={[styles.noteRow, { backgroundColor: colors.warningMuted, borderColor: colors.warning }]}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Text style={[typography.caption, { color: colors.textPrimary, flex: 1 }]}>{step.note}</Text>
        </View>
      ) : null}

      {guide.requiredFiles && guide.requiredFiles.length > 0 ? (
        <View style={styles.checklist}>
          <Text style={[typography.caption, { color: colors.textTertiary, marginBottom: spacing.xxs }]}>Benodigde bestanden</Text>
          {guide.requiredFiles.map((file) => {
            const obtained = guide.steps
              .slice(0, index + 1)
              .some((s) => (Array.isArray(s.requiredFile) ? s.requiredFile.includes(file) : s.requiredFile === file));
            return (
              <View key={file} style={styles.checklistRow}>
                <Ionicons
                  name={obtained ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={obtained ? colors.positive : colors.textTertiary}
                />
                <Text style={[typography.caption, { color: obtained ? colors.positive : colors.textTertiary }]}>{file}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.navRow}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Vorige" onPress={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} />
        </View>
        <View style={{ flex: 1 }}>
          {isLast ? (
            <PrimaryButton label="Klaar" onPress={() => onDone?.()} />
          ) : (
            <PrimaryButton label="Volgende" onPress={() => setIndex((i) => Math.min(guide.steps.length - 1, i + 1))} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  imageFrame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    marginTop: spacing.md,
    overflow: "hidden",
    aspectRatio: 16 / 10,
  },
  image: { width: "100%", height: "100%" },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  checklist: { marginTop: spacing.md },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xxs },
  navRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
});
