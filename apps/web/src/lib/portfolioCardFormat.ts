import type { Holding } from '@ai-trading/domain'

import { isCashSyntheticHolding } from './cashHolding'
import { venueLabel } from '../venueLabels'

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX'])

/** Currency / unit label used for Intl or suffix display for one holding row. */
export function holdingValueCurrency(h: Holding, portfolioBaseCurrency: string): string {
  if (isCashSyntheticHolding(h)) return portfolioBaseCurrency
  const sym = h.symbol.toUpperCase()
  if (STABLE_SYMBOLS.has(sym)) return sym
  if (sym === 'BTC' || sym === 'ETH') return sym
  if (h.venue === 'stocks') return portfolioBaseCurrency
  if (h.venue === 'polymarket') return portfolioBaseCurrency
  return portfolioBaseCurrency
}

const FIAT_ISO = new Set([
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'AUD',
  'CAD',
  'SGD',
  'HKD',
  'INR',
])

export function formatMoneyAmount(amount: number, currencyCode: string): string {
  if (FIAT_ISO.has(currencyCode)) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
      }).format(amount)
    } catch {
      /* fall through */
    }
  }
  const maxFrac = Math.abs(amount) >= 1 ? 4 : 8
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: maxFrac })} ${currencyCode}`
}

export function holdingDisplayName(h: Holding, portfolioBaseCurrency: string): string {
  if (isCashSyntheticHolding(h)) {
    return `${portfolioBaseCurrency} · Settled balance`
  }
  return `${h.symbol} · ${venueLabel(h.venue)}`
}

export function holdingQuantityLabel(h: Holding, portfolioBaseCurrency: string): string {
  if (isCashSyntheticHolding(h)) {
    return `Full ${portfolioBaseCurrency} balance (paper) — not part of position P/L above`
  }
  if (h.venue === 'stocks') {
    return `${h.quantity} ${h.quantity === 1 ? 'share' : 'shares'}`
  }
  return `${h.quantity} ${h.symbol}`
}
