# WealthOS — Design System

## Principles

- **Calm and premium, not "fintech neon".** Neutral backgrounds, one accent color (deep green), no gradients beyond subtle chart fills.
- **Numbers first.** Every screen's most important number is the largest, boldest thing on it.
- **Never guess at money.** Amounts are never color-only signals — a `+`/`-` sign and a percentage always accompany color.

## App icon & splash

A single geometric mark — an asymmetric "W" built from four straight, round-capped strokes, with the final stroke rising higher than the first to suggest upward growth without resorting to a literal chart or a dollar sign. White mark (`#FFFFFF`) on the brand deep-green field (`#1B4332`) for `assets/icon.png`; the same mark reversed (deep green on transparent) for the light-mode splash and in white on transparent for the Android adaptive-icon foreground/monochrome layers and the dark-mode splash. The mark sits well within Android's ~66% adaptive-icon safe zone so it survives circular, squircle, and rounded-square launcher masks without clipping. Source SVGs were hand-authored and rasterized with `sharp`; regenerate at a higher resolution the same way if the mark ever needs to change.

## Color

Defined in [constants/theme.ts](constants/theme.ts) as two full palettes (`light`, `dark`), switched by `useTheme()`. Every screen reads colors from this hook — never a hardcoded hex value in a component.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F7F7F5` | `#0F110F` | Screen background |
| `surface` | `#FFFFFF` | `#1A1C1A` | Cards |
| `accent` | `#1B4332` | `#5FBE8A` | Primary actions, active states |
| `positive` / `negative` | green / red | green / red | Profit/loss, always paired with text |

## Typography

System font, sized via a fixed scale in `constants/theme.ts` (`display`, `h1`–`h3`, `body`, `caption`, `micro`, `numericLarge`, `numericMedium`). Net worth uses `numericLarge` everywhere it appears — dashboard, investments, account detail — so the eye recognizes "this is the important number" consistently.

## Spacing & radius

An 8px-based scale (`xxs` 4 → `xxl` 48) and a radius scale (`sm` 8 → `pill` 999). Cards always use `radius.lg` (20). Buttons and inputs always use `radius.md` (14) and a minimum touch height of 44px.

## Components

All shared UI lives in [components/](components/): `Card`, `MoneyText`, `PercentageText`, `PrimaryButton`, `SecondaryButton`, `IconButton`, `AccountCard`, `InvestmentCard`, `TransactionRow`, `BudgetCard`, `AllocationChart`, `PortfolioChart`, `EmptyState`, `LoadingState`, `ErrorState`, `SearchBar`, `FilterChips`, `BottomSheet`, `ConfirmationModal`, plus form primitives in `components/form/`. A screen should never duplicate a card's shadow/radius/padding inline — it composes these.

## Charts

`PortfolioChart` (line/area, used for both net worth and portfolio value trends) and `AllocationChart` (donut) are hand-built on `react-native-svg` rather than a charting library, so they render identically on iOS, Android, and web, and stay themable via the same color tokens as everything else.

## Dark mode

Every screen is built against `useTheme()` from the start — there is no separate "dark mode pass". `themePreference` (`light` / `dark` / `system`) lives in Settings; `system` follows `useColorScheme()`.

## Money formatting

All amounts are integer minor units (eurocents) end to end — see `utils/money.ts` and the rationale in the README. Display always goes through `formatMoney` / `formatMoneySigned` / `formatMoneyCompact`, which apply Dutch (`nl-NL`) thousands/decimal separators. A screen never calls `.toFixed()` or builds a currency string by hand.
