# Changelog

## 0.2.0 — Live market data

Optional, free, local-only live market data. Off by default; the app is fully
functional without it, exactly as in 0.1.0.

- **Provider architecture**: a provider-agnostic `MarketDataService` orchestrator sits between the UI and two interchangeable providers behind a shared `MarketDataProviderClient` interface — **Twelve Data** (primary: quotes, symbol search, historical prices, FX rates) and **Alpha Vantage** (secondary, dividend/company overview only). No screen talks to a provider directly.
- **Bring-your-own free API key**: no WealthOS account, no hardcoded key, no key ever shipped in the app or the installer. Configure via Settings → "Live marktdata" — paste a key, test the connection, done. No terminal required.
- **Secure local key storage**: API keys are encrypted via Electron's `safeStorage` (Windows DPAPI) into a dedicated `secure-keys.json` file, completely separate from the AsyncStorage/localStorage data path the export feature reads — keys can never end up in a backup, by construction, not by a filter that could be forgotten. Verified: save → restart app → key still works → remove → key is gone → export contains zero key material.
- **Exchange-aware quotes.** A ticker like `ASML` resolves differently depending on listing — Twelve Data defaults an unqualified symbol to its US listing (NASDAQ, USD) even when the position is actually the Euronext Amsterdam listing (EUR). Symbol search returns the exchange for every match; the chosen exchange is now threaded through every quote, batch-quote, and historical-data request, and through the local cache key, so two positions sharing a ticker on different exchanges can never overwrite each other's price.
- **Cache-first, offline-safe.** Every quote/historical/dividend/company-profile fetch checks a local cache before calling any provider, and provider failures (offline, rate-limited, invalid key, unsupported symbol) always fall back to the last cached value instead of showing an error or breaking the screen. A small status badge distinguishes "Live · bijgewerkt HH:MM" from "Cache · bijgewerkt HH:MM" — delayed/cached data is never labeled as real-time.
- **Sensible refresh cadence**: stocks/ETFs/forex ~10 min, crypto ~5 min, dividend/company info ~24h, respecting Twelve Data's free-tier rate limit (8 requests/minute, 800/day) with batching for multi-position refreshes and an automatic 15-minute backoff after a rate-limit response. Auto-refresh pauses while the window is minimized/hidden.
- **Multi-currency portfolio valuation**: net worth and portfolio totals now convert each position's own currency into the user's base currency via cached FX rates, additively wrapping (not replacing) the existing single-currency calculation functions — a same-currency portfolio (the default, and all demo data) computes byte-identical totals to before.
- **Investment detail additions** (only shown for positions explicitly linked to live data): live price + live-data badge with a manual refresh button, a historical price chart with a period selector, a dividend section, and a company-info section — each hidden if the linked provider doesn't return data for that position, never showing placeholder/fake values.
- **Symbol search** in "Belegging toevoegen": search by ticker or name, pick the exact exchange listing, and the investment's ticker, exchange, currency, and asset type are filled in automatically. Manual entry (the 0.1.0 flow) still works unchanged and is the only option when live data is off.
- **Free-tier license check**: verified against Twelve Data's and Alpha Vantage's current terms that personal, non-commercial, single-user display (each user's own key, viewed only by that same user, never redistributed) is within their free-tier terms. Individual European stock/ETF availability on Twelve Data's free "Basic" plan is instrument-specific and not predictable in advance (e.g. Adyen is available, Heineken is not) — WealthOS cannot guarantee any specific ticker is free, and degrades gracefully (cached/manual value, no crash) whenever a symbol isn't available on the configured plan.
- Added ~50 new automated tests covering FX conversion/rounding, cache staleness policy, exchange-aware cache isolation, Twelve Data response parsing (success/invalid key/rate limit/malformed/timeout), cache-first/offline degradation in `MarketDataService`, and that exported/imported settings can never carry a key-shaped field.

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
