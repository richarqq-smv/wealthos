# Changelog

## Unreleased

- **Fixed the installer hanging indefinitely.** The NSIS "assisted" installer (`oneClick: false`, chosen to let the user pick an install folder) doesn't reliably honor the `/S` silent-install switch — a known electron-builder/NSIS limitation. Switched to `oneClick: true`; the installer now completes in a couple of seconds instead of hanging on an invisible wizard page. Diagnosed by ruling out OneDrive (not even running), Windows Defender (no detections, no event-log entries), and the app itself (launches instantly and cleanly from the raw unpacked build) before finding a real, empty installer window stuck mid-wizard.
- Fixed a floating-point display bug: selling part of a fractional crypto position (e.g. 0.15 BTC − 0.05) could show `0.0999999999999999` instead of `0.1` in "Aantal" due to raw IEEE-754 subtraction. `calculateWeightedAveragePosition` now rounds to 8 decimal places after every buy/sell.
- Fixed export/import/reset feedback being completely silent on desktop: React Native's `Alert.alert` is a no-op on web (react-native-web ships an empty stub), so "Import gelukt", "Export mislukt", and "Dit bestand kan niet worden geïmporteerd" never appeared. Replaced with a themed `InfoModal` component that works identically on every platform.
- Fixed a recurring console error on desktop: `BottomSheet`'s open animation used `useNativeDriver: true` unconditionally, which logs a hard error on every open on web (no native animation driver there). Now conditional on platform.
- Added a Windows desktop build: Electron wrapping the existing Expo web export, packaged with `electron-builder` into a real NSIS installer (`npm run dist:win`). No changes to app logic — same code as mobile/web.
- Desktop export/import gained a platform branch using the browser's native download/file-picker APIs (mobile keeps its `expo-file-system`/`expo-sharing` path unchanged).
- Fixed a critical desktop bug during testing: the app initially loaded via a randomly-assigned localhost port each launch, which reset `localStorage` (origin-scoped, port included) on every restart, silently discarding all data. Fixed by serving the app from a fixed custom `wealthos-app://` protocol instead, giving it a stable origin. Verified with a real install + forced-quit + relaunch cycle.
- Custom app icon, adaptive icon (foreground/background/monochrome), and light + dark splash screens replacing the Expo default assets.
- Fixed `expo-secure-store` crashing app bootstrap on platforms without support (web); settings now load correctly everywhere.
- Fixed an SVG `transform`/`origin` prop producing an invalid DOM attribute warning on web in `AllocationChart`.
- Themed native stack headers (previously default white regardless of app theme).
- EAS build configuration verified end-to-end (icons, permissions, bundle identifiers) and ready for `eas build`.

## 0.1.0 — Initial MVP

- Dashboard with net worth, wealth allocation, portfolio preview, recent transactions, and rule-based insights.
- Accounts (checking, savings, cash) with full CRUD and a balance-over-time chart.
- Investments with multiple buy/sell transactions, weighted-average cost basis, and allocation breakdown.
- Transactions with search, filters, and category grouping.
- Budgets with per-category monthly tracking and status thresholds.
- Liabilities (mortgage, loans) factored into net worth.
- Analytics screen: income/expenses, savings rate, month-over-month comparison, expense breakdown.
- Settings: theme (light/dark/system), currency, privacy mode, PIN/biometric app lock, JSON export/import, demo-data reset.
- Local-first storage via AsyncStorage-backed repositories; offline by design.
- Mock banking/brokerage/market-data providers behind interfaces, ready for future real integrations.
- Demo dataset covering 4 accounts, 8 investments, 20+ transactions, 6 budgets, 1 liability, and 12 months of portfolio snapshots.
