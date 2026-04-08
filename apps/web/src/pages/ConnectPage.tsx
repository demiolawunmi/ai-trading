import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import type { Venue } from '@ai-trading/domain'
import { useEffect, useMemo, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { VENUE_LABELS } from '../venueLabels'

type FieldType = 'text' | 'password'

type CredentialField = {
  key: string
  label: string
  type: FieldType
  placeholder: string
}

type ConnectStatusRecord = {
  configured: boolean
  status: 'connected' | 'disconnected'
  updatedAt: string
}

const LOCAL_STORAGE_KEY = 'paper-terminal.connect.credentials.v1'
const VENUES: Venue[] = ['stocks', 'crypto', 'jupiter', 'polymarket']

const VENUE_FIELDS: Record<Venue, CredentialField[]> = {
  stocks: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'stocks-api-key' },
    { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'stocks-api-secret' },
  ],
  crypto: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'crypto-api-key' },
    { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'crypto-api-secret' },
  ],
  jupiter: [
    { key: 'walletAddress', label: 'Wallet Address', type: 'text', placeholder: 'wallet-address' },
    { key: 'privateKey', label: 'Private Key', type: 'password', placeholder: 'wallet-private-key' },
  ],
  polymarket: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'polymarket-api-key' },
    { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'polymarket-api-secret' },
    { key: 'passphrase', label: 'Passphrase', type: 'password', placeholder: 'polymarket-passphrase' },
  ],
}

const toFieldId = (venue: Venue, field: string) => `${venue}.${field}`

export const ConnectPage = () => {
  const [drafts, setDrafts] = useState<Record<Venue, Record<string, string>>>(() => ({
    stocks: {},
    crypto: {},
    jupiter: {},
    polymarket: {},
  }))
  const [statusByVenue, setStatusByVenue] = useState<Record<Venue, ConnectStatusRecord> | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warning'; message: string } | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { version?: number; venues?: Partial<Record<Venue, { fields?: Record<string, string> }>> }
      if (parsed.version !== 1 || !parsed.venues) return
      setDrafts((prev) => {
        const next = { ...prev }
        for (const v of VENUES) {
          const entry = parsed.venues?.[v]
          if (entry?.fields) next[v] = { ...entry.fields }
        }
        return next
      })
    } catch {
      /* ignore */
    }
  }, [])

  const persistLocal = () => {
    const envelope = {
      version: 1 as const,
      venues: Object.fromEntries(
        VENUES.map((v) => [v, { savedAt: new Date().toISOString(), fields: drafts[v] }]),
      ),
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(envelope))
  }

  const loadRemoteStatus = async () => {
    try {
      const response = await fetch('/api/connect/status')
      if (!response.ok) throw new Error('Status request failed.')
      const payload = (await response.json()) as { venues?: Record<Venue, ConnectStatusRecord> }
      setStatusByVenue(payload.venues ?? null)
    } catch {
      setStatusByVenue(null)
    }
  }

  useEffect(() => {
    void loadRemoteStatus()
  }, [])

  const syncToWorker = async () => {
    setNotice(null)
    persistLocal()
    try {
      const venues: Partial<Record<Venue, { configured: boolean }>> = {}
      for (const v of VENUES) {
        const fields = drafts[v]
        const filled = Object.values(fields).some((x) => x.trim().length > 0)
        venues[v] = { configured: filled }
      }
      const response = await fetch('/api/connect/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venues }),
      })
      if (!response.ok) throw new Error('Sync failed.')
      const payload = (await response.json()) as { venues?: Record<Venue, ConnectStatusRecord> }
      if (payload.venues) setStatusByVenue(payload.venues)
      setNotice({ tone: 'success', message: 'Connection status synced with worker.' })
    } catch (e) {
      setNotice({ tone: 'error', message: e instanceof Error ? e.message : 'Sync failed.' })
    }
  }

  const venueCards = useMemo(
    () =>
      VENUES.map((venue) => {
        const fields = VENUE_FIELDS[venue]
        const status = statusByVenue?.[venue]
        return (
          <Box key={venue} borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
            <HStack justify="space-between" mb={3}>
              <Text fontWeight="semibold">{VENUE_LABELS[venue]}</Text>
              {status ? (
                <Badge colorScheme={status.configured ? 'green' : 'gray'}>{status.status}</Badge>
              ) : (
                <Badge>unknown</Badge>
              )}
            </HStack>
            <Stack spacing={3}>
              {fields.map((field) => (
                <FormControl key={field.key}>
                  <FormLabel htmlFor={toFieldId(venue, field.key)}>{field.label}</FormLabel>
                  <Input
                    id={toFieldId(venue, field.key)}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={drafts[venue][field.key] ?? ''}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [venue]: { ...prev[venue], [field.key]: e.target.value },
                      }))
                    }
                    autoComplete="off"
                  />
                </FormControl>
              ))}
            </Stack>
            {status?.updatedAt ? (
              <Text fontSize="xs" color="surface.muted" mt={2}>
                Updated {status.updatedAt}
              </Text>
            ) : null}
          </Box>
        )
      }),
    [drafts, statusByVenue],
  )

  return (
    <SectionCard title="Connect">
      <Text color="surface.muted">
        Store API credentials locally in the browser, then sync connection flags to the worker (simulation — no real trading).
      </Text>

      {notice ? (
        <Alert status={notice.tone === 'success' ? 'success' : notice.tone === 'warning' ? 'warning' : 'error'} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <Button colorScheme="blue" onClick={() => void syncToWorker()}>
        Save locally & sync to worker
      </Button>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        {venueCards}
      </SimpleGrid>
    </SectionCard>
  )
}
