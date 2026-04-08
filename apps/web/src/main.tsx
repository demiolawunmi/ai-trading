import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { App } from './App'
import { CurrencyProvider } from './currencyContext'
import { theme } from './theme'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </ChakraProvider>
  </React.StrictMode>,
)
