import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  FormControl,
  FormLabel,
  Select,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { ShellDataTable } from '../components/ShellDataTable'

type MetricsSnapshot = {
  realizedPnl: number
  unrealizedPnl: number
  totalEquity: number
  maxDrawdown: number
  winRate: number
  exposure: number
  sharpeLikeRatio: number
}

type MetricsWarning = {
  code: string
  message: string
  symbols: string[]
}

type StrategyRun = {
  strategyId: string
}

type MetricsResponse = {
  scope: 'account' | 'strategy'
  window: 'all' | '1h' | '24h' | '7d'
  metrics: MetricsSnapshot
  warnings: MetricsWarning[]
  summary: {
    hasActivity: boolean
    closedTrades: number
    fillCount: number
  }
}

const formatNumber = (value: number, digits = 8): string => {
  if (!Number.isFinite(value)) return '--'
  return value.toLocaleString(undefined, { maximumFractionDigits: digits })
}

const ACCOUNT_OPTION = '__account__'
const WINDOWS = ['all', '1h', '24h', '7d'] as const
type WindowOption = (typeof WINDOWS)[number]

export const MetricsPage = () => {
  const [strategyOptions, setStrategyOptions] = useState<string[]>([])
  const [selectedScope, setSelectedScope] = useState<string>(ACCOUNT_OPTION)
  const [isLoading, setIsLoading] = useState(true)
  const [windowOption, setWindowOption] = useState<WindowOption>('all')
  const [error, setError] = useState<string | null>(null)
  const [metricsResponse, setMetricsResponse] = useState<MetricsResponse | null>(null)

  const fetchStrategies = useCallback(async () => {
    const response = await fetch('/api/strategies/status')
    if (!response.ok) {
      throw new Error('Could not load strategy list for filtering.')
    }

    const payload = (await response.json()) as { runs?: StrategyRun[] }
    const unique = Array.from(new Set((payload.runs ?? []).map((run) => run.strategyId))).sort((a, b) => a.localeCompare(b))
    setStrategyOptions(unique)
  }, [])

  const fetchMetrics = useCallback(async (scopeValue: string, selectedWindow: WindowOption) => {
    const base = scopeValue === ACCOUNT_OPTION ? '/api/metrics' : `/api/metrics?strategyId=${encodeURIComponent(scopeValue)}`
    const endpoint = `${base}${base.includes('?') ? '&' : '?'}window=${encodeURIComponent(selectedWindow)}`
    const response = await fetch(endpoint)

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } }
      throw new Error(payload.error?.message ?? 'Could not load metrics data.')
    }

    const payload = (await response.json()) as MetricsResponse
    setMetricsResponse(payload)
  }, [])

  const load = useCallback(async (scopeValue: string, selectedWindow: WindowOption) => {
    setIsLoading(true)
    setError(null)

    try {
      await fetchStrategies()
      await fetchMetrics(scopeValue, selectedWindow)
    } catch (loadError) {
      setMetricsResponse(null)
      setError(loadError instanceof Error ? loadError.message : 'Could not load metrics data.')
    } finally {
      setIsLoading(false)
    }
  }, [fetchMetrics, fetchStrategies])

  useEffect(() => {
    void load(selectedScope, windowOption)
  }, [load, selectedScope, windowOption])

  const rows = useMemo(() => {
    if (!metricsResponse) return []

    return [
      ['Realized PnL', formatNumber(metricsResponse.metrics.realizedPnl)],
      ['Unrealized PnL', formatNumber(metricsResponse.metrics.unrealizedPnl)],
      ['Total Equity', formatNumber(metricsResponse.metrics.totalEquity)],
      ['Max Drawdown', formatNumber(metricsResponse.metrics.maxDrawdown)],
      ['Win Rate', formatNumber(metricsResponse.metrics.winRate)],
      ['Exposure', formatNumber(metricsResponse.metrics.exposure)],
      ['Sharpe-like Ratio', formatNumber(metricsResponse.metrics.sharpeLikeRatio)],
      ['Closed Trades', String(metricsResponse.summary.closedTrades)],
      ['Complete Fills', String(metricsResponse.summary.fillCount)],
    ]
  }, [metricsResponse])

  return (
    <SectionCard title="Metrics">
      <Text color="surface.muted">Review account-level and strategy-level PnL + risk metrics from deterministic worker analytics.</Text>
      <FormControl maxW="360px">
        <FormLabel htmlFor="metrics-scope">Scope</FormLabel>
        <Select id="metrics-scope" value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)}>
          <option value={ACCOUNT_OPTION}>Account</option>
          {strategyOptions.map((strategyId) => (
            <option key={strategyId} value={strategyId}>
              Strategy: {strategyId}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl maxW="220px">
        <FormLabel htmlFor="metrics-window">Window</FormLabel>
        <Select id="metrics-window" value={windowOption} onChange={(event) => setWindowOption(event.target.value as WindowOption)}>
          {WINDOWS.map((windowItem) => (
            <option value={windowItem} key={windowItem}>
              {windowItem}
            </option>
          ))}
        </Select>
      </FormControl>

      {isLoading ? (
        <Box borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
          <VStack align="start" spacing={2}>
            <Spinner size="sm" />
            <Text color="surface.muted">Loading metrics snapshot from worker...</Text>
          </VStack>
        </Box>
      ) : null}

      {!isLoading && error ? (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertDescription>Unable to load metrics: {error}</AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && metricsResponse && !metricsResponse.summary.hasActivity ? (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            No trading activity available for this scope yet. Place orders or start a strategy run to generate metrics.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error
        ? metricsResponse?.warnings.map((warning) => (
            <Alert status="warning" borderRadius="md" key={`${warning.code}-${warning.symbols.join(',')}`}>
              <AlertIcon />
              <AlertDescription>
                {warning.message} Symbols: {warning.symbols.join(', ')}.
              </AlertDescription>
            </Alert>
          ))
        : null}

      <ShellDataTable
        ariaLabel="Metrics snapshot table"
        columns={['Metric', 'Value']}
        rows={rows}
      />
    </SectionCard>
  )
}
