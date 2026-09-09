# Revolut broker-import fixtures

## Two tiers, deliberately kept separate

**`sanitized/` — committed to Git, used by every automated test by default.**
Derived from a real Revolut export (the same one referenced throughout the broker-import forensic review), with every occurrence of the real name, address, and account number replaced by a fixed placeholder (`Jane Tester` / `Teststraat 1` / `Testdorp` / `1234 AB` / `XX00TEST0000XX`). Every other data point — tickers, quantities, prices, timestamps, currencies, fees, dividends, ISINs, the CVX multi-lot FIFO split, the TKMS spin-off, cost basis, realized P&L — is byte-for-byte identical to the real export. Nothing about the financial test semantics changed; only the four PII fields did.

The three `.pdf` files in `sanitized/` are **not** sanitized copies of the real PDFs — they're minimal, valid, single-page placeholder PDFs containing zero real data. This is safe because every test that touches raw PDF *bytes* mocks `@/lib/pdfExtract` (pdfjs-dist is ESM-only and never runs under Jest anyway — see that module's own doc comment) and only ever uses the bytes as an opaque base64 lookup key to decide which pre-extracted `sanitized/*.pdf.items.json` to hand back. No test parses real PDF content from these `.pdf` files; the `.items.json` files carry all the real (now-sanitized) table geometry the parsers actually run against.

**`account-statement.csv`, `*.pdf`, `*.pdf.items.json` directly under `fixtures/revolut/` — real, local-only, `.gitignore`d, never committed.**
These are your own real Revolut export files (or anyone's, if you're regenerating this fixture set from a fresh account). `account-statement.csv` itself was checked and contains no name/address/account-number by construction (Revolut's ledger export is purely `Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate`) — it's excluded from Git anyway, for consistency and in case that ever changes. The PDFs and their derived `.items.json` do contain real personal data and must stay local.

## Using your own real export locally

Drop your own `account-statement.csv`/`.pdf` and `pnl-statement.pdf` (and, optionally, `costs-and-charges.pdf`) directly into this directory (`tests/brokerImport/fixtures/revolut/`, not the `sanitized/` subfolder). They're `.gitignore`d, so nothing you add here can end up in a commit. There is currently no automated test that reads them (all committed tests point at `sanitized/`) — they're a manual-regression aid for re-deriving new sanitized fixtures if the parser logic or table layout changes, using the same one-off Node-script approach documented in the broker-import implementation history (extract real PDF text items once via `pdfjs-dist` outside Jest, freeze the result as JSON, then run it through a PII-replacement pass before committing).

## Never put a real Revolut export in documentation

No README, CHANGELOG, or code comment anywhere in this repository should ever contain real transaction data, a real account number, or a real name/address. If you regenerate these fixtures from a new real export, sanitize before committing — never commit the raw extraction output directly.
