import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'
import type { Holding } from '@ai-trading/domain'
import { useEffect, useState } from 'react'
import { DISPLAY_CURRENCIES } from '../currencies'
import { SectionCard } from '../components/SectionCard'
import { ShellDataTable } from '../components/ShellDataTable'
import { useDisplayCurrency } from '../currencyContext'
import { venueLabel } from '../venueLabels'

type PortfolioResponse = {
  baseCurrency: string
  cash: number
  buyingPower: number
  holdings: Holding[]
}

export const PortfolioPage = () => {
  const { currency: displayCurrency } = useDisplayCurrency()
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [cash, setCash] = useState('100000')
  const [buyingPower, setBuyingPower] = useState('100000')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

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
        setHoldings(payload.holdings ?? [])
      } catch (error) {
        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Could not load portfolio state from worker.',
        })
      }
    }

    void load()
  }, [])

  const savePortfolio = async () => {
    setIsSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCurrency,
          cash: Number(cash),
          buyingPower: Number(buyingPower),
          holdings,
        }),
      })
      if (!response.ok) {
        throw new Error('Save failed.')
      }
      setNotice({ tone: 'success', message: 'Portfolio saved to worker.' })
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not save portfolio.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const rows = holdings.map((h, index) => [
    `${index + 1}`,
    venueLabel(h.venue),
    h.symbol,
    String(h.quantity),
    h.averageCost.toFixed(4),
    h.marketPrice !== undefined ? h.marketPrice.toFixed(4) : '—',
  ])

  return (
    <SectionCard title="Portfolio">
      <Text color="surface.muted">
        Edit paper account balances and holdings; persisted by the worker for this session. Display currency in the sidebar
        is {displayCurrency} (formatting); base currency below is stored with your portfolio.
      </Text>

      {notice ? (
        <Alert status={notice.tone === 'success' ? 'success' : 'error'} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

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
          <FormHelperText>Must match one of the supported account currencies.</FormHelperText>
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="portfolio-cash">Cash</FormLabel>
          <Input id="portfolio-cash" type="number" value={cash} onChange={(e) => setCash(e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="portfolio-bp">Buying power</FormLabel>
          <Input id="portfolio-bp" type="number" value={buyingPower} onChange={(e) => setBuyingPower(e.target.value)} />
        </FormControl>
      </SimpleGrid>

      <Box>
        <Text fontWeight="semibold" mb={2}>
          Holdings
        </Text>
        <Text fontSize="sm" color="surface.muted" mb={2}>
          For a fuller editor, use the Terminal to generate fills first — or extend this table later.
        </Text>
        <ShellDataTable
          ariaLabel="Holdings"
          columns={['#', 'Venue', 'Symbol', 'Qty', 'Avg cost', 'Mark']}
          rows={rows}
        />
      </Box>

      <HStack>
        <Button colorScheme="blue" onClick={() => void savePortfolio()} isLoading={isSaving} loadingText="Saving">
          Save portfolio
        </Button>
      </HStack>
    </SectionCard>
  )
}
