import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import {
  type DisplayCurrencyCode,
  DEFAULT_DISPLAY_CURRENCY,
  readStoredDisplayCurrency,
  writeStoredDisplayCurrency,
} from './currencies'

type CurrencyContextValue = {
  currency: DisplayCurrencyCode
  setCurrency: (code: DisplayCurrencyCode) => void
  /** Format a numeric amount in the selected display currency (symbol + decimals). */
  formatCurrency: (amount: number, options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<DisplayCurrencyCode>(() =>
    typeof window !== 'undefined' ? readStoredDisplayCurrency() : DEFAULT_DISPLAY_CURRENCY,
  )

  const setCurrency = useCallback((code: DisplayCurrencyCode) => {
    setCurrencyState(code)
    writeStoredDisplayCurrency(code)
  }, [])

  const formatCurrency = useCallback(
    (amount: number, options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }) => {
      const maximumFractionDigits = options?.maximumFractionDigits ?? 2
      const minimumFractionDigits = options?.minimumFractionDigits
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency,
          maximumFractionDigits,
          minimumFractionDigits,
        }).format(amount)
      } catch {
        return `${amount.toFixed(maximumFractionDigits)} ${currency}`
      }
    },
    [currency],
  )

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      formatCurrency,
    }),
    [currency, setCurrency, formatCurrency],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export const useDisplayCurrency = (): CurrencyContextValue => {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    throw new Error('useDisplayCurrency must be used within CurrencyProvider')
  }
  return ctx
}
