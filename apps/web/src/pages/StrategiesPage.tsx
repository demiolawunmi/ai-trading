import { Alert, AlertDescription, AlertIcon, Badge, Button, HStack, Text, VStack } from '@chakra-ui/react'
import type { StrategyRun } from '@ai-trading/domain'
import { useCallback, useEffect, useState } from 'react'
import { SectionCard } from '../components/SectionCard'

export const StrategiesPage = () => {
  const [runs, setRuns] = useState<StrategyRun[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch('/api/strategy-runs')
      if (!response.ok) throw new Error('Failed to load strategy runs.')
      const payload = (await response.json()) as { runs?: StrategyRun[] }
      setRuns(payload.runs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const start = async (id: string) => {
    setBusy(id)
    try {
      const response = await fetch(`/api/strategy-runs/${encodeURIComponent(id)}/start`, { method: 'POST' })
      if (!response.ok) throw new Error('Start failed.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start failed.')
    } finally {
      setBusy(null)
    }
  }

  const stop = async (id: string) => {
    setBusy(id)
    try {
      const response = await fetch(`/api/strategy-runs/${encodeURIComponent(id)}/stop`, { method: 'POST' })
      if (!response.ok) throw new Error('Stop failed.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stop failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <SectionCard title="Strategies">
      <Text color="surface.muted">Registered strategy runs (simulated worker).</Text>

      {error ? (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <VStack align="stretch" spacing={3}>
        {runs.map((run) => (
          <HStack
            key={run.id}
            justify="space-between"
            borderWidth="1px"
            borderColor="surface.border"
            borderRadius="md"
            p={3}
            flexWrap="wrap"
            gap={2}
          >
            <VStack align="start" spacing={0}>
              <Text fontWeight="semibold">
                {run.strategyId}{' '}
                <Badge>{run.status}</Badge>
              </Text>
              <Text fontSize="xs" color="surface.muted">
                Run {run.id}
              </Text>
            </VStack>
            <HStack>
              <Button size="sm" onClick={() => void start(run.id)} isDisabled={run.status === 'running'} isLoading={busy === run.id}>
                Start
              </Button>
              <Button size="sm" variant="outline" onClick={() => void stop(run.id)} isDisabled={run.status !== 'running'} isLoading={busy === run.id}>
                Stop
              </Button>
            </HStack>
          </HStack>
        ))}
        {runs.length === 0 ? (
          <Text color="surface.muted" fontSize="sm">
            No strategy runs yet.
          </Text>
        ) : null}
      </VStack>
    </SectionCard>
  )
}
