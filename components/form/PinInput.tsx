import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { radius, spacing, typography } from "@/constants/theme";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  /** Enter key (or tapping a completed on-screen pad) with a full-length value. */
  onSubmit?: () => void;
  onEscape?: () => void;
  /** On-screen number pad for touch/mouse — the keyboard always works regardless of this. */
  showKeypad?: boolean;
}

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"];

/**
 * A real keyboard-driven PIN entry: 0-9, Backspace, Delete, Enter, Escape,
 * Ctrl+A (native TextInput select-all) and pasting a numeric string all work
 * out of the box, because this is backed by an actual (visually hidden)
 * `TextInput` — not just a grid of Pressables reacting to onPress. The dot
 * indicators show progress; the on-screen keypad below (optional) is purely
 * an additional touch/mouse affordance that writes into the same value.
 */
export function PinInput({
  value,
  onChange,
  length = 4,
  error = false,
  autoFocus = true,
  onSubmit,
  onEscape,
  showKeypad = true,
}: PinInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const handleChangeText = (text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, "").slice(0, length);
    onChange(digitsOnly);
  };

  const handleKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = event.nativeEvent.key;
    if (key === "Enter" && value.length === length) {
      onSubmit?.();
    } else if (key === "Escape") {
      onEscape?.();
    }
  };

  const handleDigit = (digit: string) => {
    if (value.length >= length) return;
    onChange(value + digit);
    inputRef.current?.focus();
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="none" style={styles.dots}>
        {Array.from({ length }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                borderColor: error ? colors.negative : colors.textPrimary,
                backgroundColor: index < value.length ? (error ? colors.negative : colors.textPrimary) : "transparent",
              },
            ]}
          />
        ))}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={length}
        autoFocus={autoFocus}
        secureTextEntry
        caretHidden
        accessibilityLabel="PIN-code"
        style={styles.hiddenInput}
      />

      {showKeypad ? (
        <View style={styles.grid}>
          {KEYPAD_KEYS.map((key, index) => {
            if (key === "") return <View key={`empty-${index}`} style={styles.key} />;
            if (key === "backspace") {
              return (
                <Pressable
                  key={key}
                  onPress={handleBackspace}
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
                onPress={() => handleDigit(key)}
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
      ) : null}
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
  // Real, focusable, keyboard-receiving input — kept in the layout (not
  // display:none) so focus/typing/paste keep working, just visually hidden.
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
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
