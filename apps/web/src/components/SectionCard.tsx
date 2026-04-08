import { Box, Heading, Stack } from '@chakra-ui/react'
import type { ReactNode } from 'react'

type SectionCardProps = {
  title: string
  children: ReactNode
}

export const SectionCard = ({ title, children }: SectionCardProps) => {
  return (
    <Box borderWidth="1px" borderColor="surface.border" borderRadius="lg" bg="surface.panel" p={{ base: 4, md: 6 }} boxShadow="sm">
      <Stack spacing={4} align="stretch">
        <Heading as="h2" size="md">
          {title}
        </Heading>
        {children}
      </Stack>
    </Box>
  )
}
