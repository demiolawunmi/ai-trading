import { Box, Heading, VStack, type BoxProps } from '@chakra-ui/react'
import type { ReactNode } from 'react'

type SectionCardProps = {
  title: string
  children: ReactNode
} & BoxProps

export const SectionCard = ({ title, children, ...boxProps }: SectionCardProps) => {
  return (
    <Box bg="surface.panel" borderWidth="1px" borderColor="surface.border" borderRadius="lg" p={5} {...boxProps}>
      <VStack align="stretch" spacing={4}>
        <Heading as="h2" size="md">
          {title}
        </Heading>
        {children}
      </VStack>
    </Box>
  )
}
