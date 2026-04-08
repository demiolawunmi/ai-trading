import { FormControl, FormLabel, Input, type InputProps } from '@chakra-ui/react'

type FormFieldProps = {
  id: string
  label: string
} & InputProps

export const FormField = ({ id, label, ...inputProps }: FormFieldProps) => {
  return (
    <FormControl>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <Input id={id} {...inputProps} />
    </FormControl>
  )
}
