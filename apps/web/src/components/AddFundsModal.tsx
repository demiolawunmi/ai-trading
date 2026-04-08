import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'

type AddFundsModalProps = {
  isOpen: boolean
  onClose: () => void
  baseCurrencyLabel: string
  onDeposit: (amount: number) => Promise<void>
  isSubmitting: boolean
}

export const AddFundsModal = ({
  isOpen,
  onClose,
  baseCurrencyLabel,
  onDeposit,
  isSubmitting,
}: AddFundsModalProps) => {
  const [raw, setRaw] = useState('')

  useEffect(() => {
    if (!isOpen) setRaw('')
  }, [isOpen])

  const amount = Number(raw)
  const valid = Number.isFinite(amount) && amount > 0

  const submit = async () => {
    if (!valid) return
    await onDeposit(amount)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent bg="surface.panel" borderColor="surface.border">
        <ModalHeader>Add funds (paper)</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel htmlFor="add-funds-amount">Amount ({baseCurrencyLabel})</FormLabel>
            <Input
              id="add-funds-amount"
              type="number"
              min={0}
              step="any"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="0.00"
            />
            <FormHelperText>
              Increases your settled balance and buying power in {baseCurrencyLabel} by this amount. Simulation only —
              nothing moves on-chain.
            </FormHelperText>
          </FormControl>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={() => void submit()} isLoading={isSubmitting} isDisabled={!valid}>
            Add to portfolio
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
