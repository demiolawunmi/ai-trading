import { FormControl, FormLabel, Select } from '@chakra-ui/react'

import { type DisplayCurrencyCode, DISPLAY_CURRENCIES } from '../currencies'
import { useDisplayCurrency } from '../currencyContext'

type CurrencySelectorProps = {
  id?: string
  size?: 'sm' | 'md' | 'lg'
}

export const CurrencySelector = ({ id = 'app-display-currency', size = 'sm' }: CurrencySelectorProps) => {
  const { currency, setCurrency } = useDisplayCurrency()

  return (
    <FormControl>
      <FormLabel htmlFor={id} fontSize="sm" mb={1}>
        Currency
      </FormLabel>
      <Select
        id={id}
        size={size}
        value={currency}
        onChange={(e) => setCurrency(e.target.value as DisplayCurrencyCode)}
        aria-label="Display currency"
      >
        {DISPLAY_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.label}
          </option>
        ))}
      </Select>
    </FormControl>
  )
}
