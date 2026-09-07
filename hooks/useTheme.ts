import { useColorScheme } from "react-native";
import { themes, type ThemeColors } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";

export interface Theme {
  colors: ThemeColors;
  scheme: "light" | "dark";
}

export function useTheme(): Theme {
  const preference = useSettingsStore((s) => s.themePreference);
  const systemScheme = useColorScheme();
  const scheme: "light" | "dark" =
    preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;
  return { colors: themes[scheme], scheme };
}
