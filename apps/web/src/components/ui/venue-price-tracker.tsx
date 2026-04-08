import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Venue } from '@ai-trading/domain'
import { BarChart3 } from 'lucide-react'

import { cn } from '@/lib/utils'

const generateSeries = (period: '1d' | '1w' | '1m' | '3m' | '1y', seed: number) => {
  const dataPoints =
    period === '1d' ? 24 : period === '1w' ? 7 : period === '1m' ? 30 : period === '3m' ? 90 : 365
  const base = 100 + seed * 17
  return Array.from({ length: dataPoints }, (_, i) => {
    const wobble = Math.sin(i * 0.15 + seed) * 2.4 + (Math.random() - 0.5) * 1.2
    return {
      t: i,
      price: base + wobble + i * 0.02,
    }
  })
}

const presets: Record<Venue, { id: string; label: string }[]> = {
  stocks: [
    { id: 'acme', label: 'Acme Tech (illustrative)' },
    { id: 'qqq', label: 'Nasdaq proxy' },
  ],
  crypto: [
    { id: 'btc', label: 'BTC benchmark' },
    { id: 'eth', label: 'ETH benchmark' },
  ],
  jupiter: [
    { id: 'sol', label: 'SOL / USDC route' },
    { id: 'bonk', label: 'Meme pair (demo)' },
  ],
  polymarket: [
    { id: 'pm1', label: 'Event contract A' },
    { id: 'pm2', label: 'Event contract B' },
  ],
}

type VenuePriceTrackerProps = {
  venue: Venue
  className?: string
}

export function VenuePriceTracker({ venue, className }: VenuePriceTrackerProps) {
  const options = presets[venue]
  const [instrument, setInstrument] = useState(options[0]?.id ?? 'acme')
  const [period, setPeriod] = useState<'1d' | '1w' | '1m' | '3m' | '1y'>('1m')

  useEffect(() => {
    setInstrument(presets[venue][0]?.id ?? 'acme')
  }, [venue])

  const data = useMemo(() => {
    const seed = instrument.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 7
    return generateSeries(period, seed)
  }, [instrument, period])

  const last = data[data.length - 1]?.price ?? 0
  const first = data[0]?.price ?? last
  const changePct = first !== 0 ? ((last - first) / first) * 100 : 0
  const high = Math.max(...data.map((d) => d.price))
  const low = Math.min(...data.map((d) => d.price))

  const periods: { label: string; value: typeof period }[] = [
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: '1Y', value: '1y' },
  ]

  const label = options.find((o) => o.id === instrument)?.label ?? 'Demo'

  return (
    <Card className={cn('w-full max-w-full flex-col gap-4 border-border p-4 shadow-sm md:p-5', className)}>
      <CardHeader className="flex flex-col gap-3 p-0 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          Price path (demo)
        </CardTitle>
        <Select value={instrument} onValueChange={setInstrument}>
          <SelectTrigger className="h-9 w-full md:w-[220px]">
            <SelectValue placeholder="Instrument" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 p-0">
        <div className="mt-3 flex w-full divide-x overflow-hidden rounded-lg border border-border md:mt-4">
          {periods.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              data-active={period === p.value}
              className="relative flex h-8 flex-1 items-center justify-center bg-transparent text-sm font-medium text-muted-foreground outline-none first:rounded-l-lg last:rounded-r-lg hover:bg-accent/50 data-[active=true]:bg-muted/60 data-[active=true]:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">${last.toFixed(2)}</span>
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium tabular-nums',
                changePct >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400',
              )}
            >
              {changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}% (window)
            </span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>

        <div className="h-[220px] w-full [&_.recharts-cartesian-grid_line]:stroke-border/50">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis domain={['auto', 'auto']} hide width={0} />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                }}
                formatter={(value) => {
                  const v = typeof value === 'number' ? value : Number(value)
                  return [`$${Number.isFinite(v) ? v.toFixed(4) : '—'}`, 'Price']
                }}
                labelFormatter={() => 'Demo series'}
              />
              <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex w-full divide-x overflow-hidden rounded-lg border border-border">
          <div className="flex h-8 flex-1 items-center justify-center gap-1.5 text-sm">
            <span className="text-muted-foreground">High</span>
            <span className="font-medium text-foreground">{high.toFixed(3)}</span>
          </div>
          <div className="flex h-8 flex-1 items-center justify-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Low</span>
            <span className="font-medium text-foreground">{low.toFixed(3)}</span>
          </div>
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground">
          Synthetic series for UI only — your paper quote below comes from the worker when you click Preview Quote.
        </p>
      </CardContent>
    </Card>
  )
}
