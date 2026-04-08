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
import { useMemo, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { ShellDataTable } from '../components/ShellDataTable'
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

type StoredVenueCredentials = {
  savedAt: string
  fields: Record<string, string>
}

type StoredCredentialsEnvelope = {
  version: 1
  venues: Partial<Record<Venue, StoredVenueCredentials>>
}

type DraftCredentialsByVenue = Record<Venue, Record<string, string>>
type StoredCredentialsByVenue = Partial<Record<Venue, StoredVenueCredentials>>
type EditingByVenue = Record<Venue, boolean>
type RevealByField = Record<string, boolean>
type StatusByVenue = Record<Venue, ConnectStatusRecord>

type CheckStatusResponse = {
  venues?: Partial<Record<Venue, ConnectStatusRecord>>
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

const obfuscate = (value: string) => {
  const encoded = window.btoa(encodeURIComponent(value))
  return encoded.split('').reverse().join('')
}

const deobfuscate = (value: string) => {
  try {
    const reversed = value.split('').reverse().join('')
    return decodeURIComponent(window.atob(reversed))
  } catch {
    return ''
  }
}

const maskSecret = (value: string) => {
  if (!value) return '--'
  if (value.length <= 4) return '****'
  const visibleTail = value.slice(-4)
  return `${'*'.repeat(Math.max(8, value.length - 4))}${visibleTail}`
}

const createEmptyDrafts = (): DraftCredentialsByVenue => ({
  stocks: {},
  crypto: {},
  jupiter: {},
  polymarket: {},
})

const createDefaultStatuses = (): StatusByVenue => ({
  stocks: { configured: false, status: 'disconnected', updatedAt: '--' },
  crypto: { configured: false, status: 'disconnected', updatedAt: '--' },
  jupiter: { configured: false, status: 'disconnected', updatedAt: '--' },
  polymarket: { configured: false, status: 'disconnected', updatedAt: '--' },
})

const readStoredCredentials = (): StoredCredentialsByVenue => {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredCredentialsEnvelope
    if (!parsed || parsed.version !== 1 || !parsed.venues) return {}
    return parsed.venues
  } catch {
    return {}
  }
}

const persistStoredCredentials = (next: StoredCredentialsByVenue) => {
  const payload: StoredCredentialsEnvelope = {
    version: 1,
    venues: next,
  }
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
}

const buildDraftsFromStored = (storedByVenue: StoredCredentialsByVenue): DraftCredentialsByVenue => {
  const drafts = createEmptyDrafts()
  VENUES.forEach((venue) => {
    const storedVenue = storedByVenue[venue]
    if (!storedVenue) return
    const decoded: Record<string, string> = {}
    Object.entries(storedVenue.fields).forEach(([key, value]) => {
      decoded[key] = deobfuscate(value)
    })
    drafts[venue] = decoded
  })
  return drafts
}

const buildInitialEditingState = (storedByVenue: StoredCredentialsByVenue): EditingByVenue => ({
  stocks: !storedByVenue.stocks,
  crypto: !storedByVenue.crypto,
  jupiter: !storedByVenue.jupiter,
  polymarket: !storedByVenue.polymarket,
})

export const ConnectPage = () => {
  const initialStoredByVenue = useMemo(() => readStoredCredentials(), [])
  const [storedByVenue, setStoredByVenue] = useState<StoredCredentialsByVenue>(initialStoredByVenue)
  const [draftByVenue, setDraftByVenue] = useState<DraftCredentialsByVenue>(() => buildDraftsFromStored(initialStoredByVenue))
  const [editingByVenue, setEditingByVenue] = useState<EditingByVenue>(() => buildInitialEditingState(initialStoredByVenue))
  const [revealByField, setRevealByField] = useState<RevealByField>({})
  const [statusByVenue, setStatusByVenue] = useState<StatusByVenue>(createDefaultStatuses)
  const [isCheckingConnections, setIsCheckingConnections] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; message: string } | null>(null)

  const updateDraftField = (venue: Venue, field: string, value: string) => {
    setDraftByVenue((current) => ({
      ...current,
      [venue]: {
        ...current[venue],
        [field]: value,
      },
    }))
  }

  const saveVenueCredentials = (venue: Venue) => {
    const requiredFields = VENUE_FIELDS[venue].map((field) => field.key)
    const candidate = draftByVenue[venue]
    const missing = requiredFields.some((field) => !candidate[field] || !candidate[field].trim())

    if (missing) {
      setNotice({ tone: 'warning', message: `${VENUE_LABELS[venue]} credentials are incomplete.` })
      return
    }

    const obfuscatedFields: Record<string, string> = {}
    requiredFields.forEach((fieldKey) => {
      obfuscatedFields[fieldKey] = obfuscate(candidate[fieldKey].trim())
    })

    const nextStoredByVenue: StoredCredentialsByVenue = {
      ...storedByVenue,
      [venue]: {
        savedAt: new Date().toISOString(),
        fields: obfuscatedFields,
      },
    }

    persistStoredCredentials(nextStoredByVenue)
    setStoredByVenue(nextStoredByVenue)
    setEditingByVenue((current) => ({ ...current, [venue]: false }))
    setNotice({ tone: 'success', message: `${VENUE_LABELS[venue]} credentials saved locally.` })
  }

  const editVenueCredentials = (venue: Venue) => {
    const saved = storedByVenue[venue]
    if (!saved) return
    const decoded: Record<string, string> = {}
    Object.entries(saved.fields).forEach(([key, value]) => {
      decoded[key] = deobfuscate(value)
    })

    setDraftByVenue((current) => ({ ...current, [venue]: decoded }))
    setEditingByVenue((current) => ({ ...current, [venue]: true }))
    setNotice(null)
  }

  const deleteVenueCredentials = (venue: Venue) => {
    const nextStoredByVenue: StoredCredentialsByVenue = { ...storedByVenue }
    delete nextStoredByVenue[venue]
    persistStoredCredentials(nextStoredByVenue)

    setStoredByVenue(nextStoredByVenue)
    setDraftByVenue((current) => ({ ...current, [venue]: {} }))
    setEditingByVenue((current) => ({ ...current, [venue]: true }))
    setNotice({ tone: 'success', message: `${VENUE_LABELS[venue]} credentials deleted.` })
  }

  const toggleReveal = (venue: Venue, field: string) => {
    const id = toFieldId(venue, field)
    setRevealByField((current) => ({
      ...current,
      [id]: !current[id],
    }))
  }

  const checkConnections = async () => {
    setIsCheckingConnections(true)
    setNotice(null)

    const failedVenues: Venue[] = []

    try {
      await Promise.all(
        VENUES.map(async (venue) => {
          const saved = storedByVenue[venue]
          if (!saved) return

          const credentials: Record<string, string> = {}
          Object.entries(saved.fields).forEach(([key, value]) => {
            credentials[key] = deobfuscate(value)
          })

          try {
            const response = await fetch(`/api/connect/${venue}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credentials }),
            })

            if (!response.ok) {
              failedVenues.push(venue)
            }
          } catch {
            failedVenues.push(venue)
          }
        }),
      )

      const statusResponse = await fetch('/api/connect/status')
      if (!statusResponse.ok) {
        throw new Error('status-check-failed')
      }

      const payload = (await statusResponse.json()) as CheckStatusResponse
      const nextStatuses = createDefaultStatuses()

      VENUES.forEach((venue) => {
        const workerStatus = payload.venues?.[venue]
        if (!workerStatus) return
        nextStatuses[venue] = {
          configured: workerStatus.configured,
          status: workerStatus.status,
          updatedAt: workerStatus.updatedAt,
        }
      })

      setStatusByVenue(nextStatuses)

      if (failedVenues.length > 0) {
        setNotice({
          tone: 'warning',
          message: `Connection sync failed for: ${failedVenues.map((venue) => VENUE_LABELS[venue]).join(', ')}.`,
        })
      } else {
        setNotice({ tone: 'success', message: 'Connection check complete using worker status.' })
      }
    } catch {
      setNotice({ tone: 'warning', message: 'Unable to check connection status. Verify worker availability and try again.' })
    } finally {
      setIsCheckingConnections(false)
    }
  }

  const statusRows = VENUES.map((venue) => {
    const status = statusByVenue[venue]
    return [
      VENUE_LABELS[venue],
      status.configured ? 'Configured' : 'Not configured',
      status.status,
      status.updatedAt === '--' ? '--' : new Date(status.updatedAt).toLocaleString(),
    ]
  })

  return (
    <SectionCard title="Connect">
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <AlertDescription>
          Credentials are stored locally in this browser with basic obfuscation only. This is not production-grade security.
        </AlertDescription>
      </Alert>

      <Text color="surface.muted">Save, edit, and delete credentials per venue, then run a connection check against worker APIs.</Text>

      <HStack>
        <Button onClick={checkConnections} isLoading={isCheckingConnections} loadingText="Checking">
          Check Connections
        </Button>
      </HStack>

      {notice ? (
        <Alert status={notice.tone} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <ShellDataTable
        ariaLabel="Connection status table"
        columns={['Venue', 'Config', 'Status', 'Updated']}
        rows={statusRows}
      />

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        {VENUES.map((venue) => {
          const saved = storedByVenue[venue]
          const status = statusByVenue[venue]
          const isEditing = editingByVenue[venue]

          return (
            <Box key={venue} borderWidth="1px" borderColor="surface.border" borderRadius="md" p={4}>
              <HStack justify="space-between" mb={3}>
                <Text fontWeight="semibold">{VENUE_LABELS[venue]}</Text>
                <Badge colorScheme={status.status === 'connected' ? 'green' : 'orange'}>{status.status}</Badge>
              </HStack>

              {isEditing ? (
                <Stack spacing={3}>
                  {VENUE_FIELDS[venue].map((field) => (
                    <FormControl key={field.key}>
                      <FormLabel htmlFor={toFieldId(venue, field.key)}>{field.label}</FormLabel>
                      <Input
                        id={toFieldId(venue, field.key)}
                        type={field.type}
                        value={draftByVenue[venue][field.key] ?? ''}
                        placeholder={field.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => updateDraftField(venue, field.key, event.target.value)}
                      />
                    </FormControl>
                  ))}

                  <HStack>
                    <Button onClick={() => saveVenueCredentials(venue)}>Save Locally</Button>
                    {saved ? (
                      <Button variant="ghost" onClick={() => setEditingByVenue((current) => ({ ...current, [venue]: false }))}>
                        Cancel
                      </Button>
                    ) : null}
                  </HStack>
                </Stack>
              ) : (
                <Stack spacing={3}>
                  <Text fontSize="sm" color="surface.muted">
                    Saved {saved ? new Date(saved.savedAt).toLocaleString() : '--'}
                  </Text>

                  {VENUE_FIELDS[venue].map((field) => {
                    const storedValue = saved ? deobfuscate(saved.fields[field.key] ?? '') : ''
                    const fieldId = toFieldId(venue, field.key)
                    const isRevealed = revealByField[fieldId]

                    return (
                      <Box key={field.key}>
                        <Text fontSize="sm" fontWeight="medium" color="surface.muted">
                          {field.label}
                        </Text>
                        <HStack justify="space-between">
                          <Text fontFamily="mono" fontSize="sm">
                            {isRevealed ? storedValue || '--' : maskSecret(storedValue)}
                          </Text>
                          <Button size="xs" variant="outline" onClick={() => toggleReveal(venue, field.key)}>
                            {isRevealed ? 'Hide' : 'Reveal'}
                          </Button>
                        </HStack>
                      </Box>
                    )
                  })}

                  <HStack>
                    <Button size="sm" onClick={() => editVenueCredentials(venue)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" colorScheme="red" onClick={() => deleteVenueCredentials(venue)}>
                      Delete
                    </Button>
                  </HStack>
                </Stack>
              )}
            </Box>
          )
        })}
      </SimpleGrid>
    </SectionCard>
  )
}
