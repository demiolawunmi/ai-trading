import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  ButtonGroup,
  Collapse,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import type { FillComplete, FillPartial, OrderResult, Quote, Venue } from '@ai-trading/domain'
import {
  type PolymarketCatalogEntry,
  POLYMARKET_CATALOG,
  buildPolymarketSymbol,
  displayPolymarketMarket,
} from '@ai-trading/domain'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { ShellDataTable } from '../components/ShellDataTable'
import { useDisplayCurrency } from '../currencyContext'
import { venueLabel } from '../venueLabels'

type EntryMode = 'quantity' | 'notional'
type Side = 'buy' | 'sell'

type ApiErrorEnvelope = {
  error?: {
    code?: string
    message?: string
    issues?: Array<{ path?: string; message?: string }>
  }
}

const VENUES: Venue[] = ['stocks', 'crypto', 'jupiter', 'polymarket']

const SYMBOL_PATTERNS: Record<Venue, RegExp> = {
  stocks: /^[A-Z]{1,5}$/,
  crypto: /^[A-Z]{2,10}(USD|USDT|USDC)$/,
  jupiter: /^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/,
  polymarket: /^PM-[A-Z0-9-]{3,32}-(YES|NO)$/,
}

const DEFAULT_SYMBOLS: Record<Venue, string> = {
  stocks: 'AAPL',
  crypto: 'BTCUSD',
  jupiter: 'SOL/USDC',
  polymarket: buildPolymarketSymbol(POLYMARKET_CATALOG[0].slug, 'YES'),
}

const formatNumber = (value: number | undefined, digits = 4) => {
  if (value === undefined || Number.isNaN(value)) return '--'
  return value.toLocaleString(undefined, { maximumFractionDigits: digits })
}

const toApiErrorMessage = (payload: ApiErrorEnvelope, fallback: string) => {
  const issues = payload.error?.issues ?? []
  if (issues.length > 0) {
    return issues
      .map((issue) => `${issue.path ?? '$'}: ${issue.message ?? 'invalid value'}`)
      .join(' | ')
  }
  return payload.error?.message ?? fallback
}

const validateSymbol = (venue: Venue, symbol: string): string | null => {
  const trimmed = symbol.trim().toUpperCase()
  if (!trimmed) return 'Symbol is required.'
  if (!SYMBOL_PATTERNS[venue].test(trimmed)) {
    if (venue === 'stocks') return 'Use stock symbols like AAPL.'
    if (venue === 'crypto') return 'Use pairs like BTCUSD or ETHUSDT.'
    if (venue === 'jupiter') return 'Use pairs like SOL/USDC.'
    return 'Use PM-<MARKET-SLUG>-(YES|NO), for example PM-ELECTION-YES.'
  }
  return null
}

const marketLabelForActivity = (venue: Venue, symbol: string): string => {
  if (venue === 'polymarket') return displayPolymarketMarket(symbol.trim().toUpperCase())
  return '—'
}

export const TerminalPage = () => {
  const { currency, formatCurrency } = useDisplayCurrency()
  const [venue, setVenue] = useState<Venue>('stocks')
  const [symbol, setSymbol] = useState('AAPL')
  const [polymarketMode, setPolymarketMode] = useState<'catalog' | 'custom'>('catalog')
  const [polymarketSlug, setPolymarketSlug] = useState(POLYMARKET_CATALOG[0].slug)
  const [polymarketOutcome, setPolymarketOutcome] = useState<'YES' | 'NO'>('YES')
  const { isOpen: isCustomOpen, onToggle: disclosureToggle } = useDisclosure()

  const [side, setSide] = useState<Side>('buy')
  const [entryMode, setEntryMode] = useState<EntryMode>('notional')
  const [entryValue, setEntryValue] = useState('100')
  const [activityTabIndex, setActivityTabIndex] = useState(0)

  const symbolInputRef = useRef<HTMLInputElement>(null)

  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  /** Only true when the user explicitly clicks “Preview Quote” (avoids skeleton flicker on auto-refresh). */
  const [isQuoteLoading, setIsQuoteLoading] = useState(false)
  /** Subtle background refresh (no layout swap to skeletons). */
  const [isQuoteRefreshing, setIsQuoteRefreshing] = useState(false)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<OrderResult | null>(null)

  const [orders, setOrders] = useState<OrderResult[]>([])
  const [fills, setFills] = useState<Array<FillPartial | FillComplete>>([])
  const [activityError, setActivityError] = useState<string | null>(null)

  const symbolError = useMemo(() => validateSymbol(venue, symbol), [venue, symbol])
  const parsedEntryValue = Number(entryValue)
  const sizeError = useMemo(() => {
    if (!entryValue.trim()) return `${entryMode === 'quantity' ? 'Quantity' : 'Notional'} is required.`
    if (!Number.isFinite(parsedEntryValue) || parsedEntryValue <= 0) {
      return `${entryMode === 'quantity' ? 'Quantity' : 'Notional'} must be greater than 0.`
    }
    return null
  }, [entryMode, entryValue, parsedEntryValue])

  const canRequestQuote = !symbolError && !sizeError
  const canSubmitOrder = !symbolError && !sizeError && !isSubmitting

  const normalizedSymbol = symbol.trim().toUpperCase()

  const getStocksQuantityFromNotional = useCallback(() => {
    const referencePrice = quote?.last
    if (referencePrice && Number.isFinite(referencePrice) && referencePrice > 0) {
      return Math.max(1, Math.floor(parsedEntryValue / referencePrice))
    }
    return 1
  }, [parsedEntryValue, quote?.last])

  /**
   * Quote API: do not send stocks `quantity` derived from the last quote — that created a
   * feedback loop (quote → payload change → re-fetch → skeleton flicker).
   */
  const buildQuoteRequestPayload = useCallback(() => {
    const body: Record<string, unknown> = {
      venue,
      symbol: normalizedSymbol,
    }

    if (entryMode === 'quantity') {
      body.quantity = parsedEntryValue
      return body
    }

    body.notional = parsedEntryValue
    return body
  }, [entryMode, normalizedSymbol, parsedEntryValue, venue])

  /** Order API: for stocks + notional, include quantity implied by the latest quote. */
  const buildOrderPayload = useCallback(() => {
    const body = { ...buildQuoteRequestPayload() }
    if (venue === 'stocks' && entryMode === 'notional') {
      body.quantity = getStocksQuantityFromNotional()
    }
    return body
  }, [buildQuoteRequestPayload, entryMode, getStocksQuantityFromNotional, venue])

  const loadActivity = async () => {
    setActivityError(null)
    try {
      const [ordersResponse, fillsResponse] = await Promise.all([fetch('/api/orders'), fetch('/api/fills')])

      if (!ordersResponse.ok || !fillsResponse.ok) {
        throw new Error('Failed to load terminal activity.')
      }

      const ordersPayload = (await ordersResponse.json()) as { orders?: OrderResult[] }
      const fillsPayload = (await fillsResponse.json()) as { fills?: Array<FillPartial | FillComplete> }

      const nextOrders = ordersPayload.orders ?? []
      const nextFills = fillsPayload.fills ?? []
      setOrders((prev) => (JSON.stringify(prev) === JSON.stringify(nextOrders) ? prev : nextOrders))
      setFills((prev) => (JSON.stringify(prev) === JSON.stringify(nextFills) ? prev : nextFills))
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : 'Failed to load terminal activity.')
    }
  }

  useEffect(() => {
    void loadActivity()
    const intervalId = window.setInterval(() => {
      void loadActivity()
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (venue !== 'polymarket' || polymarketMode !== 'catalog') return
    setSymbol(buildPolymarketSymbol(polymarketSlug, polymarketOutcome))
  }, [venue, polymarketMode, polymarketSlug, polymarketOutcome])

  useEffect(() => {
    setQuote(null)
    setQuoteError(null)
    setSubmitError(null)
    setLastResult(null)
  }, [venue, symbol, entryMode, entryValue, side])

  const requestQuote = useCallback(
    async (options?: { silent?: boolean; showSkeleton?: boolean }) => {
      if (!canRequestQuote) return

      const silent = options?.silent === true
      const showSkeleton = options?.showSkeleton === true

      if (showSkeleton) {
        setIsQuoteLoading(true)
      } else if (silent) {
        setIsQuoteRefreshing(true)
      }
      setQuoteError(null)
      setSubmitError(null)

      const body = buildQuoteRequestPayload()

      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorPayload = (await response.json()) as ApiErrorEnvelope
          throw new Error(toApiErrorMessage(errorPayload, 'Quote request failed.'))
        }

        const payload = (await response.json()) as Quote
        setQuote(payload)
      } catch (error) {
        setQuote(null)
        setQuoteError(error instanceof Error ? error.message : 'Quote request failed.')
      } finally {
        setIsQuoteLoading(false)
        setIsQuoteRefreshing(false)
      }
    },
    [buildQuoteRequestPayload, canRequestQuote],
  )

  const submitOrder = async () => {
    if (!canSubmitOrder) return

    setIsSubmitting(true)
    setSubmitError(null)

    const body = {
      ...buildOrderPayload(),
      side,
    }

    try {
      const response = await fetch('/api/orders/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorPayload = (await response.json()) as ApiErrorEnvelope
        throw new Error(toApiErrorMessage(errorPayload, 'Order submission failed.'))
      }

      const result = (await response.json()) as OrderResult
      setLastResult(result)
      await loadActivity()
    } catch (error) {
      setLastResult(null)
      setSubmitError(error instanceof Error ? error.message : 'Order submission failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Auto-refresh quotes when inputs change; silent (no skeleton) to keep layout stable.
  useEffect(() => {
    if (!canRequestQuote) {
      setQuote(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      void requestQuote({ silent: true })
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [requestQuote, canRequestQuote, venue, symbol, entryMode, entryValue])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target !== document.body && event.target instanceof HTMLElement) {
        const tag = event.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) {
          return
        }
      }
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        if (venue === 'polymarket' && polymarketMode === 'catalog' && !isCustomOpen) {
          document.getElementById('terminal-pm-market-select')?.focus()
        } else {
          symbolInputRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [venue, polymarketMode, isCustomOpen])

  const handleVenueChange = (next: Venue) => {
    setVenue(next)
    setSymbol(DEFAULT_SYMBOLS[next])
    if (next === 'polymarket') {
      setPolymarketMode('catalog')
      setPolymarketSlug(POLYMARKET_CATALOG[0].slug)
      setPolymarketOutcome('YES')
    }
  }

  const orderRows = useMemo(() => {
    return orders.map((order, index) => {
      const amount = order.requestedNotional ?? order.requestedQuantity
      const amountLabel = order.requestedNotional !== undefined ? `Notional ${formatNumber(amount, 2)}` : `Qty ${formatNumber(amount, 6)}`
      return [
        `${index + 1}`,
        'order',
        venueLabel(order.venue),
        order.symbol,
        marketLabelForActivity(order.venue, order.symbol),
        order.side.toUpperCase(),
        order.status,
        amountLabel,
        order.reasonCode ?? '--',
      ]
    })
  }, [orders])

  const fillRows = useMemo(() => {
    return fills.map((fill, index) => {
      if (fill.type === 'FillPartial') {
        const v = fill.payload.venue
        const s = fill.payload.symbol
        return [
          `${index + 1}`,
          'fill-partial',
          venueLabel(v),
          s,
          marketLabelForActivity(v, s),
          fill.payload.side.toUpperCase(),
          'filled',
          `Qty ${formatNumber(fill.payload.quantity, 6)} @ ${formatNumber(fill.payload.price, 6)}`,
          '--',
        ]
      }

      const v = fill.payload.venue
      const s = fill.payload.symbol
      return [
        `${index + 1}`,
        'fill-complete',
        venueLabel(v),
        s,
        marketLabelForActivity(v, s),
        fill.payload.side.toUpperCase(),
        'filled',
        `Qty ${formatNumber(fill.payload.quantity, 6)} @ ${formatNumber(fill.payload.averagePrice, 6)}`,
        '--',
      ]
    })
  }, [fills])

  const allActivityRows = useMemo(() => {
    const combined = [...orderRows, ...fillRows]
    return combined.map((row, index) => [`${index + 1}`, ...row.slice(1)])
  }, [orderRows, fillRows])

  const activityColumns = ['#', 'Type', 'Venue', 'Symbol', 'Market', 'Side', 'Status', 'Details', 'Reason']

  const hasActivity = orderRows.length > 0 || fillRows.length > 0

  const quoteMid = quote && Number.isFinite(quote.bid) && Number.isFinite(quote.ask) ? (quote.bid + quote.ask) / 2 : undefined
  const quoteSpread = quote && Number.isFinite(quote.bid) && Number.isFinite(quote.ask) ? quote.ask - quote.bid : undefined

  return (
    <SectionCard title="Terminal">
      <Text color="surface.muted">
        Submit simulated market orders and review quote + fill activity from worker-backed APIs. Notional and labels use
        the display currency ({currency}) chosen in the sidebar.
      </Text>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        <FormControl>
          <FormLabel htmlFor="terminal-venue">Venue</FormLabel>
          <Select
            id="terminal-venue"
            value={venue}
            onChange={(event) => {
              handleVenueChange(event.target.value as Venue)
            }}
          >
            {VENUES.map((candidateVenue) => (
              <option value={candidateVenue} key={candidateVenue}>
                {venueLabel(candidateVenue)}
              </option>
            ))}
          </Select>
        </FormControl>

        {venue === 'polymarket' ? (
          <>
            <FormControl>
              <FormLabel id="terminal-pm-market-label">Prediction market</FormLabel>
              <Select
                id="terminal-pm-market-select"
                aria-labelledby="terminal-pm-market-label"
                value={polymarketSlug}
                onChange={(event) => {
                  setPolymarketMode('catalog')
                  setPolymarketSlug(event.target.value)
                }}
              >
                {POLYMARKET_CATALOG.map((entry: PolymarketCatalogEntry) => (
                  <option value={entry.slug} key={entry.slug}>
                    {entry.title}
                  </option>
                ))}
              </Select>
              <FormHelperText>
                {POLYMARKET_CATALOG.find((e: PolymarketCatalogEntry) => e.slug === polymarketSlug)?.title ?? ''}
              </FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel id="terminal-pm-outcome-label">Outcome</FormLabel>
              <ButtonGroup isAttached size="sm" role="group" aria-labelledby="terminal-pm-outcome-label">
                <Button
                  variant={polymarketOutcome === 'YES' ? 'solid' : 'outline'}
                  colorScheme="blue"
                  onClick={() => {
                    setPolymarketMode('catalog')
                    setPolymarketOutcome('YES')
                  }}
                >
                  YES
                </Button>
                <Button
                  variant={polymarketOutcome === 'NO' ? 'solid' : 'outline'}
                  colorScheme="blue"
                  onClick={() => {
                    setPolymarketMode('catalog')
                    setPolymarketOutcome('NO')
                  }}
                >
                  NO
                </Button>
              </ButtonGroup>
            </FormControl>

            <Box gridColumn={{ base: '1', lg: '1 / -1' }}>
              <Button
                variant="link"
                size="sm"
                colorScheme="blue"
                onClick={() => {
                  if (isCustomOpen) {
                    setPolymarketMode('catalog')
                    setSymbol(buildPolymarketSymbol(polymarketSlug, polymarketOutcome))
                  } else {
                    setPolymarketMode('custom')
                  }
                  disclosureToggle()
                }}
              >
                {isCustomOpen ? 'Hide' : 'Use'} custom symbol
              </Button>
              <Collapse in={isCustomOpen} animateOpacity>
                <FormControl mt={2} isInvalid={Boolean(symbolError)}>
                  <FormLabel htmlFor="terminal-symbol">Symbol</FormLabel>
                  <Input
                    ref={symbolInputRef}
                    id="terminal-symbol"
                    value={symbol}
                    onChange={(event) => {
                      setPolymarketMode('custom')
                      setSymbol(event.target.value)
                    }}
                    placeholder="PM-ELECTION-YES"
                    autoComplete="off"
                    spellCheck={false}
                    fontFamily="mono"
                  />
                  {symbolError ? <FormErrorMessage>{symbolError}</FormErrorMessage> : null}
                  <FormHelperText>Press / to focus symbol when not typing elsewhere.</FormHelperText>
                </FormControl>
              </Collapse>
            </Box>
          </>
        ) : (
          <FormControl isInvalid={Boolean(symbolError)}>
            <FormLabel htmlFor="terminal-symbol">Symbol</FormLabel>
            <Input
              ref={symbolInputRef}
              id="terminal-symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              placeholder={
                venue === 'stocks' ? 'AAPL' : venue === 'crypto' ? 'BTCUSD' : venue === 'jupiter' ? 'SOL/USDC' : ''
              }
              autoComplete="off"
              spellCheck={false}
            />
            {symbolError ? <FormErrorMessage>{symbolError}</FormErrorMessage> : null}
            <FormHelperText>Press / to focus symbol.</FormHelperText>
          </FormControl>
        )}

        <FormControl>
          <FormLabel id="terminal-side-label">Side</FormLabel>
          <RadioGroup value={side} onChange={(next) => setSide(next as Side)} aria-labelledby="terminal-side-label">
            <HStack spacing={4}>
              <Radio value="buy">Buy</Radio>
              <Radio value="sell">Sell</Radio>
            </HStack>
          </RadioGroup>
        </FormControl>

        <FormControl>
          <FormLabel id="terminal-entry-mode-label">Amount Type</FormLabel>
          <RadioGroup value={entryMode} onChange={(next) => setEntryMode(next as EntryMode)} aria-labelledby="terminal-entry-mode-label">
            <HStack spacing={4}>
              <Radio value="quantity">Quantity</Radio>
              <Radio value="notional">Notional</Radio>
            </HStack>
          </RadioGroup>
        </FormControl>

        <FormControl isInvalid={Boolean(sizeError)}>
          <FormLabel htmlFor="terminal-size">
            {entryMode === 'quantity' ? 'Quantity' : `Notional (${currency})`}
          </FormLabel>
          <Input
            id="terminal-size"
            type="number"
            value={entryValue}
            onChange={(event) => setEntryValue(event.target.value)}
            min={0}
            step={entryMode === 'quantity' ? '0.000001' : '0.01'}
            placeholder={entryMode === 'quantity' ? '1' : '100'}
          />
          {entryMode === 'notional' && parsedEntryValue > 0 && Number.isFinite(parsedEntryValue) ? (
            <FormHelperText>≈ {formatCurrency(parsedEntryValue)}</FormHelperText>
          ) : null}
          {sizeError ? <FormErrorMessage>{sizeError}</FormErrorMessage> : null}
        </FormControl>
      </SimpleGrid>

      <HStack spacing={3}>
        <Button
          onClick={() => void requestQuote({ showSkeleton: true })}
          isDisabled={!canRequestQuote}
          isLoading={isQuoteLoading}
          loadingText="Loading quote"
        >
          Preview Quote
        </Button>
        <Button colorScheme="blue" onClick={submitOrder} isDisabled={!canSubmitOrder} isLoading={isSubmitting} loadingText="Submitting">
          Submit Market Order
        </Button>
      </HStack>

      <Box borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4} minH="220px">
        <HStack justify="space-between" mb={3} align="center">
          <Text fontWeight="semibold">
            Quote Preview
          </Text>
          {isQuoteRefreshing ? (
            <Text fontSize="xs" color="surface.muted">
              Updating…
            </Text>
          ) : null}
        </HStack>
        {isQuoteLoading ? (
          <Stack spacing={3}>
            {venue === 'polymarket' ? <Skeleton height="16px" maxW="320px" /> : null}
            <SimpleGrid columns={{ base: 1, md: venue === 'polymarket' ? 3 : 4 }} spacing={3}>
              <Skeleton height="48px" />
              <Skeleton height="48px" />
              <Skeleton height="48px" />
              {venue === 'polymarket' ? (
                <>
                  <Skeleton height="48px" />
                  <Skeleton height="48px" />
                  <Skeleton height="48px" />
                </>
              ) : (
                <Skeleton height="48px" />
              )}
            </SimpleGrid>
          </Stack>
        ) : null}

        {!isQuoteLoading && quoteError ? (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <AlertDescription>{quoteError}</AlertDescription>
          </Alert>
        ) : null}

        {!isQuoteLoading && !quoteError && quote ? (
          <Stack
            spacing={3}
            opacity={isQuoteRefreshing ? 0.65 : 1}
            transition="opacity 0.2s ease-out"
            pointerEvents={isQuoteRefreshing ? 'none' : 'auto'}
          >
            {quote.instrumentName ? (
              <Text fontSize="sm" fontWeight="medium">
                {quote.instrumentName}
              </Text>
            ) : null}
            {venue === 'polymarket' ? (
              <>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <Stat>
                    <StatLabel>Bid</StatLabel>
                    <StatNumber>{formatNumber(quote.bid, 6)}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Ask</StatLabel>
                    <StatNumber>{formatNumber(quote.ask, 6)}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Last</StatLabel>
                    <StatNumber>{formatNumber(quote.last, 6)}</StatNumber>
                  </Stat>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <Stat>
                    <StatLabel>Mid</StatLabel>
                    <StatNumber>{formatNumber(quoteMid, 6)}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Spread</StatLabel>
                    <StatNumber>{formatNumber(quoteSpread, 6)}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Timestamp</StatLabel>
                    <StatNumber fontSize="sm">{new Date(quote.timestamp).toLocaleString()}</StatNumber>
                  </Stat>
                </SimpleGrid>
              </>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3}>
                <Stat>
                  <StatLabel>Bid</StatLabel>
                  <StatNumber>{formatNumber(quote.bid, 6)}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Ask</StatLabel>
                  <StatNumber>{formatNumber(quote.ask, 6)}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Last</StatLabel>
                  <StatNumber>{formatNumber(quote.last, 6)}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Timestamp</StatLabel>
                  <StatNumber fontSize="sm">{new Date(quote.timestamp).toLocaleString()}</StatNumber>
                </Stat>
              </SimpleGrid>
            )}
          </Stack>
        ) : null}

        {!isQuoteLoading && !quoteError && !quote && !isQuoteRefreshing ? (
          <Text color="surface.muted">No quote loaded yet.</Text>
        ) : null}
        {!isQuoteLoading && !quoteError && !quote && isQuoteRefreshing ? (
          <Text color="surface.muted" fontSize="sm">
            Fetching quote…
          </Text>
        ) : null}
      </Box>

      {submitError ? (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle mr={2}>Order failed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      {lastResult ? (
        <Alert status={lastResult.status === 'accepted' ? 'success' : 'warning'} borderRadius="md">
          <AlertIcon />
          <AlertTitle mr={2}>{lastResult.status === 'accepted' ? 'Order accepted' : 'Order rejected'}</AlertTitle>
          <AlertDescription>
            {venueLabel(lastResult.venue)} {lastResult.symbol} {lastResult.side.toUpperCase()} {lastResult.message ?? ''}{' '}
            {lastResult.reasonCode ? `(${lastResult.reasonCode})` : ''}
          </AlertDescription>
        </Alert>
      ) : null}

      {activityError ? (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <AlertDescription>{activityError}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs variant="enclosed" colorScheme="blue" index={activityTabIndex} onChange={setActivityTabIndex}>
        <TabList>
          <Tab>All activity</Tab>
          <Tab>Orders</Tab>
          <Tab>Fills</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            {!hasActivity ? (
              <Box borderWidth="1px" borderColor="surface.border" borderRadius="md" p={6} textAlign="center">
                <Text color="surface.muted" mb={2}>
                  No orders or fills yet.
                </Text>
                <Text fontSize="sm" color="surface.muted">
                  Submit a market order above to see activity here.
                </Text>
              </Box>
            ) : (
              <ShellDataTable ariaLabel="Terminal activity table" columns={activityColumns} rows={allActivityRows} />
            )}
          </TabPanel>
          <TabPanel px={0}>
            {orderRows.length === 0 ? (
              <Box borderWidth="1px" borderColor="surface.border" borderRadius="md" p={6} textAlign="center">
                <Text color="surface.muted">No orders yet.</Text>
              </Box>
            ) : (
              <ShellDataTable
                ariaLabel="Terminal orders table"
                columns={activityColumns}
                rows={orderRows.map((row, index) => [`${index + 1}`, ...row.slice(1)])}
              />
            )}
          </TabPanel>
          <TabPanel px={0}>
            {fillRows.length === 0 ? (
              <Box borderWidth="1px" borderColor="surface.border" borderRadius="md" p={6} textAlign="center">
                <Text color="surface.muted">No fills yet.</Text>
              </Box>
            ) : (
              <ShellDataTable
                ariaLabel="Terminal fills table"
                columns={activityColumns}
                rows={fillRows.map((row, index) => [`${index + 1}`, ...row.slice(1)])}
              />
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Stack spacing={1}>
        <Text fontSize="xs" color="surface.muted">
          Market orders only. Advanced order types are intentionally out of scope for this MVP.
        </Text>
      </Stack>
    </SectionCard>
  )
}
