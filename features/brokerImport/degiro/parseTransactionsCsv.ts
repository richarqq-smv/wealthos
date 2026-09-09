import type { NormalizedBrokerTransaction } from "../types";

/**
 * NEEDS REAL DEGIRO FIXTURE. No genuine DEGIRO Transaction/Account
 * Statement export was available while building this (see the forensic
 * review §18/§24 and features/brokerImport/degiro/adapter.ts's module
 * doc). The column layout below is community-reported (multiple
 * independent third-party guides converge on the same shape), NOT
 * confirmed against degiro.com's own documentation at the field level —
 * treat every assumption here as UNKNOWN / NEEDS VERIFICATION:
 *
 *   Datum;Tijd;Product;ISIN;Beurs;...;Aantal;Koers;...;Waarde;...
 *
 * - Semicolon-delimited (not comma) and Dutch dd-MM-yyyy dates with
 *   comma-decimal numbers are the consistently reported convention —
 *   UNVERIFIED.
 * - No dedicated fee/commission column is reported to exist; costs are
 *   said to appear embedded in a free-text description elsewhere (the
 *   Account Statement, not this Transaction file) — UNVERIFIED, and this
 *   parser makes NO attempt to extract fees from free text rather than
 *   guess at a text-parsing heuristic with zero real data to validate it.
 * - No realized-P&L/cost-basis column exists (CONFIRMED independently —
 *   see adapter.ts) — every row this parser produces is a raw buy/sell
 *   event only; `pnlSource` is always null, `costBasisKnown` always
 *   undefined. The shared FIFO fallback (features/brokerImport/fifoFallback.ts,
 *   wired in via confirmImport.ts) is responsible for turning these into
 *   closed-lot P&L once this parser actually returns real rows — not this
 *   file, and not yet exercised end-to-end since this parser is still a
 *   no-op.
 *
 * This function intentionally does the minimum defensible thing: refuse
 * to parse (return an empty result) rather than silently produce
 * plausible-looking but unverified data. Replace this once a real DEGIRO
 * export is available to build and test against, following the same
 * real-fixture-first process used for features/brokerImport/revolut/*.
 */
export function parseDegiroTransactionsCsv(_text: string, _fileName: string): NormalizedBrokerTransaction[] {
  return [];
}
