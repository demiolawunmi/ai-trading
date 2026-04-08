import type { Venue } from '@ai-trading/domain'

import { FinancialTable } from '@/components/ui/financial-markets-table'
import {
  DEMO_CRYPTO_PAIRS,
  DEMO_JUPITER_POOLS,
  DEMO_POLYMARKETS,
  DEMO_STOCK_INDICES,
} from './terminalDemoData'

export function TerminalVenueOverview({ venue }: { venue: Venue }) {
  switch (venue) {
    case 'stocks':
      return <FinancialTable title="Index" nameColumnLabel="Index" indices={DEMO_STOCK_INDICES} />
    case 'crypto':
      return <FinancialTable title="Pair" nameColumnLabel="Pair" indices={DEMO_CRYPTO_PAIRS} />
    case 'jupiter':
      return <FinancialTable title="Pool" nameColumnLabel="Pool" indices={DEMO_JUPITER_POOLS} />
    case 'polymarket':
      return <FinancialTable title="Market" nameColumnLabel="Contract" indices={DEMO_POLYMARKETS} />
    default:
      return null
  }
}
