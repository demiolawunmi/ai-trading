import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  FormControl,
  FormLabel,
  Select,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { MetricsSnapshot } from '@ai-trading/domain'
import { useCallback, useEffect, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { useDisplayCurrency } from '../currencyContext'

const WINDOWS = ['1d', '7d', '30d', 'all'] as const
type WindowOption = (typeof WINDOWS)[number]

export const MetricsPage = () => {
  const { formatCurrency } = useDisplayCurrency()
  const [windowOption, setWindowOption] = useState<WindowOption>('7d')
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/metrics?window=${encodeURIComponent(windowOption)}`)
      if (!response.ok) throw new Error('Failed to load metrics.')
      const payload = (await response.json()) as MetricsSnapshot
      setMetrics(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics.')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [windowOption])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SectionCard title="Metrics">
      <Text color="surface.muted">
        Account-level PnL and risk metrics (deterministic simulation snapshot). Amounts use the currency selected in the
        sidebar.
      </Text>

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

      {loading ? (
        <Box borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
          <VStack align="start" spacing={2}>
            <Spinner size="sm" />
            <Text color="surface.muted">Loading metrics snapshot from worker...</Text>
          </VStack>
        </Box>
      ) : null}

      {!loading && error ? (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertDescription>Unable to load metrics: {error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error && metrics ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
          <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
            <StatLabel>Realized PnL</StatLabel>
            <StatNumber>{formatCurrency(metrics.realizedPnl)}</StatNumber>
          </Stat>
          <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
            <StatLabel>Unrealized PnL</StatLabel>
            <StatNumber>{formatCurrency(metrics.unrealizedPnl)}</StatNumber>
          </Stat>
          <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
            <StatLabel>Total equity</StatLabel>
            <StatNumber>{formatCurrency(metrics.totalEquity)}</StatNumber>
          </Stat>
          <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
            <StatLabel>Max drawdown</StatLabel>
            <StatNumber>{(metrics.maxDrawdown * 100).toFixed(2)}%</StatNumber>
          </Stat>
          <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
            <StatLabel>Win rate</StatLabel>
            <StatNumber>{(metrics.winRate * 100).toFixed(1)}%</StatNumber>
          </Stat>
          <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
            <StatLabel>Exposure</StatLabel>
            <StatNumber>{(metrics.exposure * 100).toFixed(1)}%</StatNumber>
          </Stat>
        </SimpleGrid>
      ) : null}

      {!loading && !error && !metrics ? (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <AlertTitle mr={2}>No data</AlertTitle>
          <AlertDescription>No metrics available.</AlertDescription>
        </Alert>
      ) : null}
    </SectionCard>
  )
}
