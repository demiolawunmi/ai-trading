import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

export const theme = extendTheme({
  config,
  fonts: {
    heading: "'IBM Plex Sans', system-ui, sans-serif",
    body: "'IBM Plex Sans', system-ui, sans-serif",
  },
  colors: {
    brand: {
      50: '#eef6ff',
      100: '#d8e9ff',
      500: '#2b6cb0',
      700: '#1f4f83',
    },
    surface: {
      canvas: '#f4f8fb',
      panel: '#ffffff',
      text: '#142130',
      muted: '#516173',
      border: '#d9e2ec',
      hover: '#edf2f7',
      warningBg: '#fff3e0',
      warningText: '#8a4700',
      successBg: '#e8f5e9',
      successText: '#1b5e20',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'surface.canvas',
        color: 'surface.text',
      },
    },
  },
})
