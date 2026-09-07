export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const touchSize = {
  min: 44,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const fontFamily = {
  regular: "System",
  medium: "System",
  semibold: "System",
  bold: "System",
} as const;

export const typography = {
  display: { fontSize: 40, lineHeight: 46, fontWeight: "700" as const },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "700" as const },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "600" as const },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  bodyMedium: { fontSize: 15, lineHeight: 21, fontWeight: "500" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: "500" as const },
  numericLarge: { fontSize: 34, lineHeight: 40, fontWeight: "700" as const },
  numericMedium: { fontSize: 20, lineHeight: 26, fontWeight: "600" as const },
} as const;

const lightColors = {
  background: "#F7F7F5",
  backgroundElevated: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F0F1EE",
  border: "#E4E4E0",
  textPrimary: "#141614",
  textSecondary: "#5B6058",
  textTertiary: "#8B9088",
  accent: "#1B4332",
  accentMuted: "#DCEAE1",
  onAccent: "#FFFFFF",
  positive: "#1F7A4D",
  positiveMuted: "#E3F3E9",
  negative: "#C1443A",
  negativeMuted: "#FBEAE8",
  warning: "#B8791A",
  warningMuted: "#FBF0DE",
  chartLine: "#1B4332",
  chartGrid: "#E4E4E0",
  overlay: "rgba(20, 22, 20, 0.45)",
  skeleton: "#E9E9E5",
  tabInactive: "#9BA097",
  allocation: ["#1B4332", "#3E8E64", "#89C9A4", "#C9A24B", "#8B6F4E", "#9BA097"],
};

const darkColors = {
  background: "#0F110F",
  backgroundElevated: "#1A1C1A",
  surface: "#1A1C1A",
  surfaceMuted: "#232523",
  border: "#2E302E",
  textPrimary: "#F2F3F1",
  textSecondary: "#AEB3AA",
  textTertiary: "#787D75",
  accent: "#5FBE8A",
  accentMuted: "#1E3327",
  onAccent: "#0F110F",
  positive: "#5FBE8A",
  positiveMuted: "#17281E",
  negative: "#E2766D",
  negativeMuted: "#301918",
  warning: "#E0A94F",
  warningMuted: "#332A15",
  chartLine: "#5FBE8A",
  chartGrid: "#2E302E",
  overlay: "rgba(0, 0, 0, 0.6)",
  skeleton: "#232523",
  tabInactive: "#6D726A",
  allocation: ["#5FBE8A", "#3E8E64", "#1B4332", "#D9B865", "#A98B63", "#6D726A"],
};

export type ThemeColors = typeof lightColors;

export const themes = {
  light: lightColors,
  dark: darkColors,
};

export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
