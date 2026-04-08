import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import type { MarketIndex } from '@/components/terminal/terminalTypes'

export type { MarketIndex } from '@/components/terminal/terminalTypes'

type FinancialTableProps = {
  title?: string
  indices?: MarketIndex[]
  onIndexSelect?: (indexId: string) => void
  className?: string
  /** Column header for the first column (e.g. Index, Pair, Pool). */
  nameColumnLabel?: string
}

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

const formatLargeNumber = (amount: number, unit: string) => {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}${unit}`
  return `${amount.toFixed(1)}${unit}`
}

const formatPercentage = (value: number) => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

const performanceBadge = (value: number) => {
  const positive = value >= 0
  return {
    bgColor: positive ? 'bg-emerald-500/10 dark:bg-emerald-500/15' : 'bg-red-500/10 dark:bg-red-500/15',
    borderColor: positive ? 'border-emerald-500/30 dark:border-emerald-500/40' : 'border-red-500/30 dark:border-red-500/40',
    textColor: positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
  }
}

const FlagAvatar = ({ code }: { code: string }) => (
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-[10px] font-bold uppercase text-muted-foreground">
    {code.slice(0, 2)}
  </div>
)

export function FinancialTable({
  title = 'Index',
  indices = [],
  onIndexSelect,
  className = '',
  nameColumnLabel,
}: FinancialTableProps) {
  const [selectedIndex, setSelectedIndex] = useState<string | null>(indices[0]?.id ?? null)
  const shouldReduceMotion = useReducedMotion()
  const firstCol = nameColumnLabel ?? title

  const handleIndexSelect = (indexId: string) => {
    setSelectedIndex(indexId)
    onIndexSelect?.(indexId)
  }

  const renderSparkline = (data: number[]) => {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const points = data
      .map((value, index) => {
        const x = (index / Math.max(data.length - 1, 1)) * 60
        const y = 20 - ((value - min) / range) * 15
        return `${x},${y}`
      })
      .join(' ')

    return (
      <div className="h-6 w-16">
        <motion.svg
          width="60"
          height="20"
          viewBox="0 0 60 20"
          className="overflow-visible text-primary"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 25,
            duration: shouldReduceMotion ? 0.2 : 0.5,
          }}
        >
          {points ? (
            <motion.polyline
              points={points}
              fill="none"
              className="stroke-primary"
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: shouldReduceMotion ? 0.3 : 0.8,
                ease: 'easeOut',
                delay: 0.1,
              }}
            />
          ) : null}
        </motion.svg>
      </div>
    )
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '250px 100px minmax(60px, 1fr) minmax(60px, 1fr) minmax(60px, 1fr) minmax(60px, 1fr) minmax(80px, 1fr) minmax(60px, 1fr) minmax(100px, 1fr)',
    columnGap: '6px',
  }

  const containerVariants = {
    visible: {
      transition: { staggerChildren: 0.04, delayChildren: 0.08 },
    },
  }

  const rowVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 400, damping: 28 },
    },
  }

  if (indices.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-border/50 bg-background p-8 text-center text-sm text-muted-foreground', className)}>
        No illustrative rows for this venue.
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-7xl', className)}>
      <p className="mb-2 text-xs text-muted-foreground">
        Illustrative snapshot for orientation — not live market data. Paper trades below use simulated quotes from the worker.
      </p>
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-background">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div
              className="border-b border-border/20 bg-muted/15 px-8 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
              style={gridStyle}
            >
              <div>{firstCol}</div>
              <div>YTD Return</div>
              <div>P/LTM EPS</div>
              <div>Div yield</div>
              <div>Mkt cap</div>
              <div>Volume</div>
              <div>Spark</div>
              <div>Price</div>
              <div className="pr-4">1d</div>
            </div>

            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              {indices.map((row, indexNum) => (
                <motion.div key={row.id} variants={rowVariants}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'group relative cursor-pointer px-8 py-3 transition-colors duration-200',
                      selectedIndex === row.id ? 'border-b border-border/30 bg-muted/50' : 'hover:bg-muted/30',
                      indexNum < indices.length - 1 && selectedIndex !== row.id ? 'border-b border-border/20' : '',
                    )}
                    style={gridStyle}
                    onClick={() => handleIndexSelect(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleIndexSelect(row.id)
                      }
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <FlagAvatar code={row.countryCode} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground/90">{row.name}</div>
                        <div className="text-xs text-muted-foreground/80">{row.country}</div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      {(() => {
                        const { bgColor, borderColor, textColor } = performanceBadge(row.ytdReturn)
                        return (
                          <div className={cn('rounded-lg border px-2 py-1 text-xs font-medium', bgColor, borderColor, textColor)}>
                            {formatPercentage(row.ytdReturn)}
                          </div>
                        )
                      })()}
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-foreground/90">{row.pltmEps != null ? row.pltmEps.toFixed(2) : 'N/A'}</span>
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-orange-500">{formatPercentage(row.divYield)}</span>
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-foreground/90">{formatLargeNumber(row.marketCap, 'B')}</span>
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-foreground/90">
                        {row.volume >= 1 ? formatLargeNumber(row.volume, 'M') : `${(row.volume * 1000).toFixed(1)}k`}
                      </span>
                    </div>

                    <div className="flex items-center px-2">{renderSparkline(row.chartData)}</div>

                    <div className="flex items-center">
                      <span className="font-semibold text-foreground/90">{formatCurrency(row.price)}</span>
                    </div>

                    <div className="flex items-center gap-2 pr-4">
                      <span className={cn('font-semibold', performanceBadge(row.dailyChange).textColor)}>
                        {row.dailyChange >= 0 ? '+' : ''}
                        {row.dailyChange.toFixed(2)}
                      </span>
                      {(() => {
                        const { bgColor, borderColor, textColor } = performanceBadge(row.dailyChangePercent)
                        return (
                          <div className={cn('rounded-lg border px-2 py-1 text-xs font-medium', bgColor, borderColor, textColor)}>
                            {formatPercentage(row.dailyChangePercent)}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
