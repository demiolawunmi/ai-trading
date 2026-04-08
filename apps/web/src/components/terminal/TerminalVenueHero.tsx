import type { Venue } from '@ai-trading/domain'

import { venueLabel } from '@/venueLabels'

const COPY: Record<
  Venue,
  { headline: string; body: string; bullets: string[] }
> = {
  stocks: {
    headline: 'US-style equities (paper)',
    body: 'Quotes and fills are simulated in your local worker — nothing routes to a real exchange. Use this lane to rehearse size, notional, and activity the same way you would for single-name stocks.',
    bullets: ['Symbols like AAPL, MSFT', 'Bid / ask / last from the quote API', 'Fills update portfolio + terminal activity'],
  },
  crypto: {
    headline: 'Spot-style crypto pairs (paper)',
    body: 'Pairs like BTCUSD behave like simplified spot rails: still fully simulated. Good for practicing notional sizing and seeing how the shell records crypto venue orders.',
    bullets: ['Suffix-style pairs (e.g. BTCUSD)', 'Same order + quote flow as other venues', 'No wallet or chain interaction'],
  },
  jupiter: {
    headline: 'DEX-style routes (paper)',
    body: 'Jupiter-inspired symbol format (BASE/QUOTE) lets you model routed swaps without Solana RPC traffic. The worker returns deterministic quotes for rehearsal.',
    bullets: ['Use pairs like SOL/USDC', 'Helpful for mental model of per-pair notionals', 'Still paper — no on-chain execution'],
  },
  polymarket: {
    headline: 'Prediction outcomes (paper)',
    body: 'Polymarket-like YES/NO contracts use catalog slugs or custom PM-… symbols. Outcome prices are simulated for strategy and UI testing only.',
    bullets: ['Catalog markets or custom symbols', 'Binary outcome quotes', 'Great for testing conditional logic before real integrations'],
  },
}

export function TerminalVenueHero({ venue }: { venue: Venue }) {
  const c = COPY[venue]
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm md:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper terminal</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
        {venueLabel(venue)} · {c.headline}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{c.body}</p>
      <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {c.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  )
}
