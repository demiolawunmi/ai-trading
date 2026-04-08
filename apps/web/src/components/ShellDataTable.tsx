import {
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
} from '@chakra-ui/react'
import type { ReactNode } from 'react'

export type ShellDataTableCell = string | ReactNode

type ShellDataTableProps = {
  columns: string[]
  rows: ShellDataTableCell[][]
  ariaLabel: string
}

export const ShellDataTable = ({ columns, rows, ariaLabel }: ShellDataTableProps) => {
  return (
    <TableContainer borderWidth="1px" borderColor="surface.border" borderRadius="md">
      <Table variant="simple" size="sm" aria-label={ariaLabel}>
        <Thead bg="surface.hover">
          <Tr>
            {columns.map((column) => (
              <Th key={column}>{column}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {rows.length === 0 ? (
            <Tr>
              <Td colSpan={columns.length}>
                <Text color="surface.muted">No rows yet.</Text>
              </Td>
            </Tr>
          ) : (
            rows.map((row, rowIndex) => (
              <Tr key={`row-${rowIndex.toString()}`}>
                {row.map((cell, cellIndex) => (
                  <Td key={`cell-${rowIndex.toString()}-${cellIndex.toString()}`}>{cell}</Td>
                ))}
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </TableContainer>
  )
}
