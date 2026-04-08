/** Fiat codes used for display formatting (simulation remains USD-centric in the worker unless you extend it). */
export const DISPLAY_CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'INR', label: 'Indian Rupee' },
] as const

export type DisplayCurrencyCode = (typeof DISPLAY_CURRENCIES)[number]['code']

export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrencyCode = 'USD'

const STORAGE_KEY = 'paper-terminal.displayCurrency.v1'

export const readStoredDisplayCurrency = (): DisplayCurrencyCode => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DISPLAY_CURRENCY
    const valid = DISPLAY_CURRENCIES.some((c) => c.code === raw)
    return valid ? (raw as DisplayCurrencyCode) : DEFAULT_DISPLAY_CURRENCY
  } catch {
    return DEFAULT_DISPLAY_CURRENCY
  }
}

export const writeStoredDisplayCurrency = (code: DisplayCurrencyCode) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* ignore */
  }
}
