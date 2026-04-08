import { Badge, Button, HStack, Text } from '@chakra-ui/react'

import { useWorkerAvailability } from '../hooks/useWorkerAvailability'

export const WorkerStatusBanner = () => {
  const { ok, detail, refresh } = useWorkerAvailability()

  const label =
    ok === null ? 'Checking worker…' : ok ? 'Worker online' : 'Worker offline'

  const scheme = ok === null ? 'gray' : ok ? 'green' : 'red'

  return (
    <HStack
      flex="1"
      justify="space-between"
      borderWidth="1px"
      borderColor="surface.border"
      borderRadius="md"
      bg="surface.panel"
      px={4}
      py={3}
      spacing={3}
      flexWrap="wrap"
    >
      <HStack spacing={3}>
        <Badge colorScheme={scheme} variant="subtle">
          {label}
        </Badge>
        <Text fontSize="sm" color="surface.muted">
          {detail}
        </Text>
      </HStack>
      <Button size="sm" variant="outline" onClick={() => void refresh()}>
        Retry
      </Button>
    </HStack>
  )
}
