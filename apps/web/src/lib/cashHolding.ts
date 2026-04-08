import type { Holding } from '@ai-trading/domain'

/** Synthetic row only — not stored in the worker; mirrors `cash` on the portfolio. */
export const CASH_SYMBOL = 'CASH' as const

export const isCashSyntheticHolding = (h: Holding): boolean => h.symbol === CASH_SYMBOL

/** Build a display-only holding representing settled cash (qty × $1 notional = cash balance). */
export function cashAsDisplayHolding(cashBalance: number): Holding {
  return {
    venue: 'stocks',
    symbol: CASH_SYMBOL,
    quantity: cashBalance,
    averageCost: 1,
    marketPrice: 1,
  }
}

/** Strip any legacy CASH rows before save or display merge. */
export const stripCashFromHoldings = (holdings: Holding[]): Holding[] =>
  holdings.filter((h) => !isCashSyntheticHolding(h))
