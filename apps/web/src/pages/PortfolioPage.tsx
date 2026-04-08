import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Collapse,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import type { Holding, MetricsSnapshot } from '@ai-trading/domain'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StockPortfolioCard } from '@/components/ui/stock-portfolio-card'
import { AddFundsModal } from '../components/AddFundsModal'
import { DISPLAY_CURRENCIES } from '../currencies'
import { ShellDataTable } from '../components/ShellDataTable'
import { cashAsDisplayHolding, stripCashFromHoldings } from '../lib/cashHolding'
import { useDisplayCurrency } from '../currencyContext'
import { venueLabel } from '../venueLabels'

type PortfolioResponse = {
  baseCurrency: string
  cash: number
  buyingPower: number
  holdings: Holding[]
}

export const PortfolioPage = () => {
  const { currency: displayCurrency, formatCurrency } = useDisplayCurrency()
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [cash, setCash] = useState('100000')
  const [buyingPower, setBuyingPower] = useState('100000')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null)
  const [accountDetailsOpen, setAccountDetailsOpen] = useState(false)
  const addFundsModal = useDisclosure()

  const persistPortfolio = useCallback(
    async (payload: {
      baseCurrency: string
      cash: number
      buyingPower: number
      holdings: Holding[]
    }) => {
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          holdings: stripCashFromHoldings(payload.holdings),
        }),
      })
      if (!response.ok) {
        throw new Error('Could not save portfolio to worker.')
      }
      try {
        const metricsResponse = await fetch('/api/metrics')
        if (metricsResponse.ok) {
          setMetrics((await metricsResponse.json()) as MetricsSnapshot)
        }
      } catch {
        /* ignore */
      }
    },
    [],
  )

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/portfolio')
        if (!response.ok) {
          throw new Error('Could not load portfolio state from worker.')
        }

        const payload = (await response.json()) as PortfolioResponse
        setBaseCurrency(payload.baseCurrency)
        setCash(String(payload.cash))
        setBuyingPower(String(payload.buyingPower))
        setHoldings(stripCashFromHoldings(payload.holdings ?? []))
      } catch (error) {
        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Could not load portfolio state from worker.',
        })
      }
    }

    void load()
  }, [])

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await fetch('/api/metrics')
        if (!response.ok) return
        setMetrics((await response.json()) as MetricsSnapshot)
      } catch {
        setMetrics(null)
      }
    }
    void loadMetrics()
  }, [holdings, cash, buyingPower, baseCurrency])

  const savePortfolio = async () => {
    setIsSaving(true)
    setNotice(null)
    try {
      await persistPortfolio({
        baseCurrency,
        cash: Number(cash),
        buyingPower: Number(buyingPower),
        holdings,
      })
      setNotice({ tone: 'success', message: 'Account settings saved to worker.' })
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not save portfolio.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const depositFunds = async (amount: number) => {
    setIsDepositing(true)
    setNotice(null)
    try {
      const nextCash = Number(cash) + amount
      const nextBp = Number(buyingPower) + amount
      setCash(String(nextCash))
      setBuyingPower(String(nextBp))
      await persistPortfolio({
        baseCurrency,
        cash: nextCash,
        buyingPower: nextBp,
        holdings,
      })
      setNotice({
        tone: 'success',
        message: `Added ${formatCurrency(amount)} to settled ${baseCurrency} and buying power (paper).`,
      })
      addFundsModal.onClose()
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not add funds.',
      })
    } finally {
      setIsDepositing(false)
    }
  }

  const cashNum = Number(cash)
  const bpNum = Number(buyingPower)

  const displayHoldings = useMemo(
    () => [cashAsDisplayHolding(Number.isFinite(cashNum) ? cashNum : 0), ...holdings],
    [cashNum, holdings],
  )

  const positionRows = useMemo(() => {
    const cashRow = [
      '—',
      'Account',
      baseCurrency,
      Number.isFinite(cashNum) ? cashNum.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—',
      '1.0000',
      '1.0000',
    ]
    const rest = holdings.map((h, index) => [
      `${index + 1}`,
      venueLabel(h.venue),
      h.symbol,
      String(h.quantity),
      h.averageCost.toFixed(4),
      h.marketPrice !== undefined ? h.marketPrice.toFixed(4) : '—',
    ])
    return [cashRow, ...rest]
  }, [baseCurrency, cashNum, holdings])

  const summary = useMemo(() => {
    const costBasis = holdings.reduce((s, h) => s + h.quantity * h.averageCost, 0)
    const fallbackUnrealized = holdings.reduce((s, h) => {
      const m = h.marketPrice ?? h.averageCost
      return s + (m - h.averageCost) * h.quantity
    }, 0)
    const totalPnl =
      metrics !== null ? metrics.realizedPnl + metrics.unrealizedPnl : fallbackUnrealized
    const returnPct = costBasis > 0 ? (100 * totalPnl) / costBasis : 0
    return { totalPnl, returnPct }
  }, [holdings, metrics])

  const asOfDate = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
      }).format(new Date()),
    [],
  )

  return (
    <Stack spacing={{ base: 6, md: 8 }} align="stretch">
      <Box>
        <Heading as="h1" size="lg" mb={1}>
          Paper portfolio
        </Heading>
        <Text color="surface.muted" fontSize="sm">
          Simulated balances and positions. Display currency in the sidebar ({displayCurrency}) only affects number
          formatting; account currency is {baseCurrency}.
        </Text>
      </Box>

      {notice ? (
        <Alert status={notice.tone === 'success' ? 'success' : 'error'} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <StockPortfolioCard
        totalGainFormatted={formatCurrency(summary.totalPnl)}
        returnPercentFormatted={`${summary.returnPct.toFixed(2)}%`}
        returnIsPositive={summary.returnPct >= 0}
        asOfDate={asOfDate}
        holdings={displayHoldings}
        portfolioBaseCurrency={baseCurrency}
        positionsOnlyCash={holdings.length === 0}
      />

      <Flex
        direction={{ base: 'column', sm: 'row' }}
        gap={4}
        align={{ base: 'stretch', sm: 'center' }}
        justify="space-between"
        flexWrap="wrap"
      >
        <Button colorScheme="blue" onClick={addFundsModal.onOpen}>
          Add funds
        </Button>
        {metrics ? (
          <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} flex="1" minW="0">
            <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={3}>
              <StatLabel>Total equity</StatLabel>
              <StatNumber fontSize="lg">{formatCurrency(metrics.totalEquity)}</StatNumber>
            </Stat>
            <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={3}>
              <StatLabel>Settled {baseCurrency}</StatLabel>
              <StatNumber fontSize="lg">{formatCurrency(cashNum)}</StatNumber>
            </Stat>
            <Stat borderWidth="1px" borderColor="surface.border" borderRadius="md" p={3}>
              <StatLabel>Buying power</StatLabel>
              <StatNumber fontSize="lg">{formatCurrency(bpNum)}</StatNumber>
            </Stat>
          </SimpleGrid>
        ) : (
          <Text fontSize="sm" color="surface.muted">
            Load metrics from the worker to see equity.
          </Text>
        )}
      </Flex>

      <Box>
        <Button
          variant="ghost"
          size="sm"
          px={0}
          onClick={() => setAccountDetailsOpen((o) => !o)}
          aria-expanded={accountDetailsOpen}
        >
          {accountDetailsOpen ? 'Hide' : 'Show'} account details (currency & manual balances)
        </Button>
        <Collapse in={accountDetailsOpen} animateOpacity>
          <Box
            mt={3}
            borderWidth="1px"
            borderColor="surface.border"
            borderRadius="lg"
            bg="surface.panel"
            p={{ base: 4, md: 5 }}
          >
            <Text fontSize="sm" color="surface.muted" mb={4}>
              Use this when you need to edit base currency or type balances directly. For normal top-ups, prefer{' '}
              <strong>Add funds</strong>.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl>
                <FormLabel htmlFor="portfolio-base">Base currency</FormLabel>
                <Select id="portfolio-base" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
                  {DISPLAY_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                  {!DISPLAY_CURRENCIES.some((c) => c.code === baseCurrency) && baseCurrency ? (
                    <option value={baseCurrency}>{baseCurrency} (from server)</option>
                  ) : null}
                </Select>
                <FormHelperText>Stored with your paper account.</FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="portfolio-cash">Settled {baseCurrency}</FormLabel>
                <Input id="portfolio-cash" type="number" value={cash} onChange={(e) => setCash(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="portfolio-bp">Buying power</FormLabel>
                <Input id="portfolio-bp" type="number" value={buyingPower} onChange={(e) => setBuyingPower(e.target.value)} />
              </FormControl>
            </SimpleGrid>
            <HStack mt={4}>
              <Button colorScheme="blue" onClick={() => void savePortfolio()} isLoading={isSaving} loadingText="Saving">
                Save account settings
              </Button>
            </HStack>
          </Box>
        </Collapse>
      </Box>

      <Box>
        <Heading as="h2" size="sm" mb={1}>
          All positions
        </Heading>
        <Text fontSize="sm" color="surface.muted" mb={3}>
          First row is settled {baseCurrency}; symbol positions from the Terminal follow. Use Add funds to increase your{' '}
          {baseCurrency} balance without editing cells.
        </Text>
        <ShellDataTable
          ariaLabel="Portfolio positions"
          columns={['#', 'Venue', 'Symbol', 'Qty / balance', 'Avg cost', 'Mark']}
          rows={positionRows}
        />
      </Box>

      <AddFundsModal
        isOpen={addFundsModal.isOpen}
        onClose={addFundsModal.onClose}
        baseCurrencyLabel={baseCurrency}
        onDeposit={depositFunds}
        isSubmitting={isDepositing}
      />
    </Stack>
  )
}
