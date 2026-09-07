import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, typography } from "@/constants/theme";

interface PinPadProps {
  pin: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  length?: number;
  error?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"];

export function PinPad({ pin, onDigit, onBackspace, length = 4, error = false }: PinPadProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                borderColor: error ? colors.negative : colors.textPrimary,
                backgroundColor: index < pin.length ? (error ? colors.negative : colors.textPrimary) : "transparent",
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, index) => {
          if (key === "") return <View key={`empty-${index}`} style={styles.key} />;
          if (key === "backspace") {
            return (
              <Pressable
                key={key}
                onPress={onBackspace}
                accessibilityRole="button"
                accessibilityLabel="Verwijderen"
                style={styles.key}
              >
                <Ionicons name="backspace-outline" size={24} color={colors.textPrimary} />
              </Pressable>
            );
          }
          return (
            <Pressable
              key={key}
              onPress={() => onDigit(key)}
              accessibilityRole="button"
              accessibilityLabel={`Cijfer ${key}`}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
              ]}
            >
              <Text style={[typography.h1, { color: colors.textPrimary }]}>{key}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.xl },
  dots: { flexDirection: "row", gap: spacing.sm },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 260,
    justifyContent: "center",
  },
  key: {
    width: 260 / 3,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
});
