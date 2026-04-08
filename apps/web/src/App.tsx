import React from 'react'
import { Box, Heading } from '@chakra-ui/react'
import { getAppName } from '@ai-trading/domain'

export const App = () => {
  return (
    <Box p={4}>
      <Heading>Hello from {getAppName()} Web!</Heading>
    </Box>
  )
}
