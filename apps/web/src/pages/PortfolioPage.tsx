import { Alert, AlertDescription, AlertIcon, Button, HStack, SimpleGrid, Text } from '@chakra-ui/react'
import type { Holding } from '@ai-trading/domain'
import { useEffect, useMemo, useState } from 'react'
import { FormField } from '../components/FormField'
import { SectionCard } from '../components/SectionCard'
import { ShellDataTable } from '../components/ShellDataTable'

type PortfolioResponse = {
  baseCurrency: string
  cash: number
  buyingPower: number
  holdings: Holding[]
}

export const PortfolioPage = () => {
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
    const parsedCash = Number(cash)
    const parsedBuyingPower = Number(buyingPower)
    if (!Number.isFinite(parsedCash) || !Number.isFinite(parsedBuyingPower)) {
      setNotice({ tone: 'error', message: 'Cash and Buying Power must be valid numbers.' })
      return
    }

    setIsSaving(true)
    setNotice(null)

    try {
      const response = await fetch('/api/portfolio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCurrency,
          cash: parsedCash,
          buyingPower: parsedBuyingPower,
          holdings,
        }),
      })

      if (!response.ok) {
        throw new Error('Portfolio update failed.')
      }

      const payload = (await response.json()) as PortfolioResponse
      setBaseCurrency(payload.baseCurrency)
      setCash(String(payload.cash))
      setBuyingPower(String(payload.buyingPower))
      setHoldings(payload.holdings ?? [])
      setNotice({ tone: 'success', message: 'Portfolio saved.' })
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Portfolio update failed.' })
    } finally {
      setIsSaving(false)
    }
  }

  const holdingRows = useMemo(
    () =>
      holdings.map((holding) => [
        holding.venue,
        holding.symbol,
        String(holding.quantity),
        String(holding.averageCost),
      ]),
    [holdings],
  )

  return (
    <SectionCard title="Portfolio">
      <Text color="surface.muted">
        Edit cash and buying power, then save through the worker-backed portfolio API.
      </Text>

      {notice ? (
        <Alert status={notice.tone} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <Text fontSize="sm" color="surface.muted">
        Base Currency: {baseCurrency}
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <FormField
          id="portfolio-cash"
          label="Cash"
          placeholder="100000"
          type="number"
          value={cash}
          onChange={(event) => setCash(event.target.value)}
        />
        <FormField
          id="portfolio-buying-power"
          label="Buying Power"
          placeholder="100000"
          type="number"
          value={buyingPower}
          onChange={(event) => setBuyingPower(event.target.value)}
        />
      </SimpleGrid>

      <HStack>
        <Button onClick={savePortfolio} isLoading={isSaving} loadingText="Saving">
          Save Portfolio
        </Button>
      </HStack>

      <ShellDataTable
        ariaLabel="Portfolio holdings table"
        columns={['Venue', 'Symbol', 'Quantity', 'Average Cost']}
        rows={holdingRows}
      />
    </SectionCard>
  )
}
