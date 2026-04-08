import * as React from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, MoreHorizontal, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { isCashSyntheticHolding } from '@/lib/cashHolding'
import {
  formatMoneyAmount,
  holdingDisplayName,
  holdingQuantityLabel,
  holdingValueCurrency,
} from '@/lib/portfolioCardFormat'
import type { Holding } from '@ai-trading/domain'

export type StockPortfolioCardProps = {
  totalGainFormatted: string
  returnPercentFormatted: string
  returnIsPositive: boolean
  asOfDate: string
  holdings: Holding[]
  portfolioBaseCurrency: string
  /** When true, only settled balance exists — explains $0 position P/L. */
  positionsOnlyCash: boolean
  className?: string
}

const HoldingRow: React.FC<{
  holding: Holding
  baseCurrency: string
}> = ({ holding, baseCurrency }) => {
  const ccy = holdingValueCurrency(holding, baseCurrency)
  const mark = holding.marketPrice
  const avg = holding.averageCost
  const hasMark = mark !== undefined && mark !== null
  const isCash = isCashSyntheticHolding(holding)

  const lastPrice = hasMark ? mark : avg
  const priceLine = isCash
    ? formatMoneyAmount(holding.quantity, ccy)
    : formatMoneyAmount(lastPrice, ccy)

  let changeBlock: { positive: boolean; line: string } | null = null
  if (isCash) {
    changeBlock = null
  } else if (hasMark) {
    const changeValue = (mark - avg) * holding.quantity
    const changePercent = avg !== 0 ? (100 * (mark - avg)) / avg : 0
    const positive = changeValue >= 0
    changeBlock = {
      positive,
      line: `${formatMoneyAmount(changeValue, ccy)} (${changePercent.toFixed(2)}%)`,
    }
  }

  const positive = changeBlock?.positive ?? true

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <span className="max-w-[2.5rem] truncate text-[10px] font-bold uppercase leading-tight text-muted-foreground">
            {isCash ? baseCurrency.slice(0, 4) : holding.symbol}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{holdingDisplayName(holding, baseCurrency)}</p>
          <p className="text-sm text-muted-foreground">{holdingQuantityLabel(holding, baseCurrency)}</p>
        </div>
      </div>
      <div className="shrink-0 pl-2 text-right">
        <p className="font-semibold text-card-foreground">{priceLine}</p>
        {isCash ? (
          <p className="text-sm text-muted-foreground">No market P/L</p>
        ) : changeBlock ? (
          <div
            className={cn(
              'flex items-center justify-end gap-1 text-sm',
              positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}
          >
            {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{changeBlock.line}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  )
}

export const StockPortfolioCard = ({
  totalGainFormatted,
  returnPercentFormatted,
  returnIsPositive,
  asOfDate,
  holdings,
  portfolioBaseCurrency,
  positionsOnlyCash,
  className,
}: StockPortfolioCardProps) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 120 },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'w-full max-w-none space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm',
        className,
      )}
    >
      <motion.div variants={itemVariants} className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Position P/L (symbols only)</p>
          <h2 className="text-4xl font-bold tracking-tight">{totalGainFormatted}</h2>
          <div
            className={cn(
              'mt-1 flex items-center gap-2 text-sm font-medium',
              returnIsPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}
          >
            {returnIsPositive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {returnPercentFormatted} vs position cost basis
          </div>
          <p className="mt-2 max-w-xl text-xs leading-snug text-muted-foreground">
            {positionsOnlyCash ? (
              <>
                Settled {portfolioBaseCurrency} is listed under Holdings; this P/L line only includes tradable symbols.
                With no symbol positions yet, it stays at zero — use the Terminal to open trades if you want movement
                here.
              </>
            ) : (
              <>
                Settled {portfolioBaseCurrency} appears in Holdings below; it does not affect this figure — only your
                open symbol positions do.
              </>
            )}
          </p>
        </div>
        <p className="text-sm text-muted-foreground sm:mt-0">As of {asOfDate}</p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Holdings</h3>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="More actions">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {holdings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No holdings yet.</p>
          ) : (
            holdings.map((holding) => (
              <HoldingRow key={`${holding.venue}-${holding.symbol}`} holding={holding} baseCurrency={portfolioBaseCurrency} />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
