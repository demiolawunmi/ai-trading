import type { Venue } from '@ai-trading/domain'

export const VENUE_LABELS: Record<Venue, string> = {
  stocks: 'Stocks',
  crypto: 'Crypto',
  jupiter: 'Jupiter',
  polymarket: 'Polymarket',
}

export const venueLabel = (venue: Venue): string => VENUE_LABELS[venue] ?? venue
