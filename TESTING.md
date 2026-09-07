# WealthOS — Test Strategy

## Desktop (Electron) persistence — verified manually

The Windows build was smoke-tested end to end: silently installed to a scratch directory, launched, demo data seeded, **force-killed** (`taskkill /F`, simulating a crash/hard-close rather than a clean quit), and relaunched. This caught a real bug — the app initially served itself over a randomly-assigned localhost port each launch, and since `localStorage` is scoped per origin (port included), every restart landed on a fresh empty origin and silently lost all data. Fixed by switching to a fixed custom `wealthos-app://` protocol (see `electron/main.js`). Re-tested with the same kill+relaunch cycle: net worth, accounts, and navigation all correctly persisted. Re-run this check after any change to `electron/main.js`.

## Unit tests

`tests/calculations.test.ts` and `tests/money.test.ts` cover the two areas where a bug would silently corrupt a number the user trusts:

- **`lib/calculations.ts`** — every function required by the spec: total cash, portfolio value, total assets/liabilities, net worth, profit/loss, return %, wealth and portfolio allocation, weighted-average purchase price, monthly income/expenses, savings rate, budget usage/status. Edge cases explicitly covered: zero accounts/investments, negative account balances (roodstand), zero invested capital (division-by-zero guard), a sell that exceeds the held quantity (quantity must clamp at zero, never go negative), out-of-order transaction dates, and a zero-amount budget.
- **`utils/money.ts`** — minor-unit conversion (including rounding of fractional cents), Dutch (`nl-NL`) formatting, signed formatting, and percentage formatting.

Run: `npm test`. Coverage is scoped to `lib/**` and `utils/**` (`collectCoverageFrom` in `package.json`'s `jest` config) since that's where financial correctness lives — UI components are exercised through manual QA (below), not snapshot tests, to avoid brittle tests that break on every visual tweak.

## Why these functions and not others

Per the project's own priority order (correctness first), any function that reads two or more entities and produces a number a screen displays *unverified* is a candidate for a unit test. Functions that just filter/sort/map for display (e.g. `groupLabelForDate`) are simple enough that a test would mostly restate the implementation — those are covered by manual QA instead.

## Manual QA checklist

Run through this after any change to `lib/calculations.ts`, a repository, or a store — that's where a regression would silently produce a wrong number rather than a crash.

**Dashboard**
- [ ] Opens directly to data (no menu-hunting) on both fresh install (onboarding) and return visits
- [ ] Net worth = cash + portfolio − liabilities, and matches Accounts/Investments/Liabilities screens exactly
- [ ] Net worth chart renders for every period (1W/1M/3M/6M/1J/Alles) and shows "not enough data" gracefully when a period has under 2 points
- [ ] Privacy mode masks every amount (including inside charts' active-point label) and persists across app restarts

**Accounts**
- [ ] Add / edit / delete all persist and immediately update the dashboard total
- [ ] Editing a balance updates "Saldo over tijd" and "laatst bijgewerkt"
- [ ] Delete requires confirmation

**Investments**
- [ ] Add creates an implicit first buy transaction so the transaction history is never empty for a non-zero starting position
- [ ] "Bijkopen" and "Verkopen" recompute quantity and weighted-average price from the full transaction history, not from the previous displayed value
- [ ] A sell can never take quantity below zero
- [ ] Sort (value/return/name) and type filters both apply and combine correctly
- [ ] Delete cascades to that investment's transactions

**Transactions**
- [ ] Add/edit/delete correctly adjusts the linked account's balance exactly once (no double-booking — see "Transaction impact" in the README) and reverses the old effect before applying a new one on edit
- [ ] Search matches description and category; type filter combines with search
- [ ] Grouping by date shows "Vandaag"/"Gisteren" and falls back to the full date otherwise

**Budgets**
- [ ] Usage percentage and status (ok/warning/danger/over) match the 70/90/100% thresholds
- [ ] Only expenses in the matching category and month count toward usage

**Settings**
- [ ] Theme (light/dark/system) applies immediately and persists
- [ ] Currency change reflects in new formatting immediately
- [ ] PIN setup requires entering the same 4 digits twice; a wrong confirmation restarts the flow
- [ ] Biometric option only enables after a real hardware check + successful prompt — it never shows as "on" if the device has no biometric hardware enrolled
- [ ] Export produces a valid JSON file matching `ExportPayload`; import rejects malformed/foreign JSON with "Dit bestand kan niet worden geïmporteerd." and never partially applies it
- [ ] Demo-data reset asks for confirmation and fully replaces all financial collections

**Navigation**
- [ ] All 5 tabs load; Android hardware back and browser back both behave sensibly on detail screens
- [ ] Deep links (e.g. `/account/<id>`) load directly without requiring the tab flow first

## Known platform-specific note

The web preview target (`expo start --web`) is used for fast visual QA during development. `BottomSheet`'s `Modal` can mis-position on web when the underlying page has scrolled (a `react-native-web` quirk — `Modal` there is CSS-positioned rather than a true native overlay); clicking its buttons by exact pixel coordinate still worked in manual testing. This has not been verified on an actual iOS/Android simulator or device (none was available in this environment) — `Modal` is a native overlay on both platforms, so it is expected to behave correctly there, but that expectation should be confirmed with a real device/simulator pass before shipping.
