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
  },
  semanticTokens: {
    colors: {
      'surface.canvas': { default: '#f4f8fb', _dark: '#0d1117' },
      'surface.panel': { default: '#ffffff', _dark: '#161b22' },
      'surface.text': { default: '#142130', _dark: '#e6edf3' },
      'surface.muted': { default: '#516173', _dark: '#8b9cb0' },
      'surface.border': { default: '#d9e2ec', _dark: '#30363d' },
      'surface.hover': { default: '#edf2f7', _dark: '#21262d' },
      'surface.warningBg': { default: '#fff3e0', _dark: '#3d2e1a' },
      'surface.warningText': { default: '#8a4700', _dark: '#ffb74d' },
      'surface.successBg': { default: '#e8f5e9', _dark: '#1b2e1f' },
      'surface.successText': { default: '#1b5e20', _dark: '#81c784' },
      'brand.navHighlight': { default: '#d8e9ff', _dark: '#1c2d44' },
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
