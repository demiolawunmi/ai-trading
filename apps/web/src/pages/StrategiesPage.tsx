import { SimpleGrid, Text } from '@chakra-ui/react'
import { FormField } from '../components/FormField'
import { SectionCard } from '../components/SectionCard'
import { ShellDataTable } from '../components/ShellDataTable'

export const StrategiesPage = () => {
  return (
    <SectionCard title="Strategies">
      <Text color="surface.muted">
        Strategy registration and runtime controls are introduced in Task 10. This page defines the route scaffold.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <FormField id="strategy-name" label="Strategy Name" placeholder="mean-reversion-v1" />
        <FormField id="strategy-symbol" label="Primary Symbol" placeholder="BTC-USD" />
      </SimpleGrid>
      <ShellDataTable
        ariaLabel="Strategies table"
        columns={['Strategy ID', 'Status', 'Last Updated']}
        rows={[]}
      />
    </SectionCard>
  )
}
