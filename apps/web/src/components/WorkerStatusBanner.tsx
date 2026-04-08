import { Box, HStack, Text } from '@chakra-ui/react'
import { useWorkerAvailability } from '../hooks/useWorkerAvailability'

const formatCheckedAt = (checkedAt: string | null) => {
  if (!checkedAt) {
    return 'Status not checked yet'
  }
  return `Checked ${new Date(checkedAt).toLocaleTimeString()}`
}

export const WorkerStatusBanner = () => {
  const availability = useWorkerAvailability()

  if (availability.connected) {
    return (
      <HStack
        role="status"
        aria-live="polite"
        bg="surface.successBg"
        color="surface.successText"
        borderWidth="1px"
        borderColor="surface.border"
        borderRadius="md"
        px={4}
        py={3}
        w="100%"
        justify="space-between"
      >
        <Text fontWeight="semibold">Worker connected</Text>
        <Text fontSize="sm">{formatCheckedAt(availability.checkedAt)}</Text>
      </HStack>
    )
  }

  return (
    <Box
      role="alert"
      aria-live="assertive"
      bg="surface.warningBg"
      color="surface.warningText"
      borderWidth="1px"
      borderColor="surface.border"
      borderRadius="md"
      px={4}
      py={3}
      w="100%"
    >
      <Text fontWeight="semibold">Backend disconnected</Text>
      <Text fontSize="sm">
        Worker API is unavailable at `http://localhost:4000`. Start the worker to enable trading features.
      </Text>
      <Text fontSize="xs" mt={1}>
        {formatCheckedAt(availability.checkedAt)}
      </Text>
    </Box>
  )
}
