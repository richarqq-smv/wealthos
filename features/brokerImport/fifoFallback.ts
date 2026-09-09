/**
 * Shared FIFO cost-basis/realized-P&L calculator for brokers whose exports
 * don't ship a pre-computed figure (`BrokerCapabilities.providesRealizedPnl
 * === false` — currently DEGIRO, per features/brokerImport/degiro/adapter.ts).
 * Broker-agnostic and pure: no I/O, no broker-specific fields. Never called
 * for a broker whose own report already provides realized P&L (Revolut) —
 * that would silently overwrite a broker-reported figure with a recalculated
 * one, which the forensic review explicitly forbids.
 */

export interface FifoTransactionInput {
  /** Caller-supplied identifier used only to attach results back to the right row. */
  id: string;
  type: "buy" | "sell";
  quantity: number;
  /** Per-unit execution price. */
  priceMinor: number;
  /** Total fees/commission for this transaction, prorated into cost basis (buy) or proceeds (sell). */
  feesMinor?: number;
  /** ISO timestamp — lots are consumed in chronological order (earliest buy first). */
  timestamp: string;
}

export interface FifoSellResult {
  transactionId: string;
  /** Cost basis for the matched quantity only. */
  costBasisMinor: number;
  proceedsMinor: number;
  realizedPnlMinor: number;
  /** Quantity this sell could not match against any known buy lot (e.g. a sell predating the imported history). Cost basis for that portion is NOT included above and must never be treated as zero. */
  quantityUnmatched: number;
}

interface Lot {
  quantity: number;
  unitCostMinor: number;
}

/**
 * Computes FIFO realized P&L for a single instrument's full buy/sell
 * history. Rows are sorted by timestamp before processing regardless of
 * input order. Returns one result per sell row (buys produce no result).
 */
export function calculateFifoRealizedPnl(transactions: FifoTransactionInput[]): FifoSellResult[] {
  const sorted = [...transactions].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const lots: Lot[] = [];
  const results: FifoSellResult[] = [];

  for (const t of sorted) {
    if (t.type === "buy") {
      if (t.quantity <= 0) continue;
      const totalCostMinor = t.priceMinor * t.quantity + (t.feesMinor ?? 0);
      lots.push({ quantity: t.quantity, unitCostMinor: totalCostMinor / t.quantity });
      continue;
    }

    let remaining = t.quantity;
    let costBasisMinor = 0;
    while (remaining > 1e-9 && lots.length > 0) {
      const lot = lots[0]!; // guaranteed by the `lots.length > 0` loop condition
      const consumed = Math.min(lot.quantity, remaining);
      costBasisMinor += consumed * lot.unitCostMinor;
      lot.quantity -= consumed;
      remaining -= consumed;
      if (lot.quantity <= 1e-9) lots.shift();
    }

    const matchedQuantity = t.quantity - remaining;
    const proceedsMinor = t.priceMinor * matchedQuantity - (t.feesMinor ?? 0) * (t.quantity > 0 ? matchedQuantity / t.quantity : 0);

    results.push({
      transactionId: t.id,
      costBasisMinor: Math.round(costBasisMinor),
      proceedsMinor: Math.round(proceedsMinor),
      realizedPnlMinor: Math.round(proceedsMinor - costBasisMinor),
      quantityUnmatched: remaining,
    });
  }

  return results;
}
