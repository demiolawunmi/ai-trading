import { MoonIcon, SunIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Heading,
  HStack,
  Link,
  Text,
  IconButton,
  useColorMode,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { CurrencySelector } from './components/CurrencySelector'
import { WorkerStatusBanner } from './components/WorkerStatusBanner'
import { ConnectPage } from './pages/ConnectPage'
import { MetricsPage } from './pages/MetricsPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { StrategiesPage } from './pages/StrategiesPage'
import { TerminalPage } from './pages/TerminalPage'
import { TERMINAL_VENUES, parseAppRoute, type AppRoute } from './routing'
import { venueLabel } from './venueLabels'

const PAGE_LINKS = [
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/strategies', label: 'Strategies' },
  { path: '/metrics', label: 'Metrics' },
  { path: '/connect', label: 'Connect' },
] as const

const ColorModeToggle = () => {
  const { colorMode, toggleColorMode } = useColorMode()
  const isLight = colorMode === 'light'
  return (
    <IconButton
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      icon={isLight ? <MoonIcon /> : <SunIcon />}
      variant="ghost"
      size="sm"
      onClick={toggleColorMode}
    />
  )
}

const TerminalNavLinks = ({ route, onNavigate }: { route: AppRoute; onNavigate?: () => void }) => (
  <VStack align="stretch" spacing={0}>
    <Text px={3} fontSize="xs" fontWeight="semibold" color="surface.muted" mb={1}>
      Terminal
    </Text>
    {TERMINAL_VENUES.map((venue) => {
      const active = route.kind === 'terminal' && route.venue === venue
      return (
        <Link
          key={venue}
          href={`#/terminal/${venue}`}
          px={3}
          py={2}
          borderRadius="md"
          bg={active ? 'brand.navHighlight' : 'transparent'}
          _hover={{ textDecoration: 'none', bg: 'surface.hover' }}
          _focusVisible={{ boxShadow: 'outline' }}
          fontWeight={active ? 'semibold' : 'medium'}
          fontSize="sm"
          onClick={onNavigate}
        >
          {venueLabel(venue)}
        </Link>
      )
    })}
  </VStack>
)

const PageNavLinks = ({ route, onNavigate }: { route: AppRoute; onNavigate?: () => void }) => (
  <VStack as="nav" aria-label="Other pages" align="stretch" spacing={1}>
    {PAGE_LINKS.map((item) => {
      const active = route.kind === 'page' && route.path === item.path
      return (
        <Link
          key={item.path}
          href={`#${item.path}`}
          px={3}
          py={2}
          borderRadius="md"
          bg={active ? 'brand.navHighlight' : 'transparent'}
          _hover={{ textDecoration: 'none', bg: 'surface.hover' }}
          _focusVisible={{ boxShadow: 'outline' }}
          fontWeight={active ? 'semibold' : 'medium'}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      )
    })}
  </VStack>
)

const renderRoute = (route: AppRoute) => {
  if (route.kind === 'page') {
    if (route.path === '/portfolio') return <PortfolioPage />
    if (route.path === '/strategies') return <StrategiesPage />
    if (route.path === '/metrics') return <MetricsPage />
    if (route.path === '/connect') return <ConnectPage />
    return <PortfolioPage />
  }
  return <TerminalPage venueFromRoute={route.venue} />
}

export const App = () => {
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(window.location.hash))
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { colorMode } = useColorMode()

  useEffect(() => {
    const root = document.documentElement
    if (colorMode === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [colorMode])

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '#/terminal/stocks'
      setRoute(parseAppRoute('#/terminal/stocks'))
      return
    }

    const onHashChange = () => {
      setRoute(parseAppRoute(window.location.hash))
    }

    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  const content = useMemo(() => renderRoute(route), [route])

  return (
    <Flex minH="100vh" bg="surface.canvas" color="surface.text" direction="column">
      <Flex
        display={{ base: 'flex', md: 'none' }}
        align="center"
        justify="space-between"
        px={4}
        py={3}
        borderBottomWidth="1px"
        borderColor="surface.border"
        bg="surface.panel"
      >
        <Heading as="h1" size="md">
          Paper Terminal
        </Heading>
        <Button size="sm" variant="outline" onClick={onOpen} aria-label="Open navigation menu">
          Menu
        </Button>
      </Flex>

      <Flex flex="1" minH={0}>
        <VStack
          as="aside"
          align="stretch"
          spacing={3}
          w={{ base: '100%', md: '260px' }}
          display={{ base: 'none', md: 'flex' }}
          borderRightWidth="1px"
          borderColor="surface.border"
          bg="surface.panel"
          p={4}
        >
          <Heading as="h2" size="md">
            Paper Terminal
          </Heading>
          <Text fontSize="sm" color="surface.muted">
            Local-first simulation shell
          </Text>
          <Divider borderColor="surface.border" />
          <Flex justify="flex-end">
            <ColorModeToggle />
          </Flex>
          <CurrencySelector id="app-display-currency-sidebar" />
          <Divider borderColor="surface.border" />
          <TerminalNavLinks route={route} />
          <Divider borderColor="surface.border" />
          <Text px={3} fontSize="xs" fontWeight="semibold" color="surface.muted">
            Account & tools
          </Text>
          <PageNavLinks route={route} />
        </VStack>

        <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
          <DrawerOverlay />
          <DrawerContent bg="surface.panel">
            <DrawerCloseButton />
            <DrawerHeader borderBottomWidth="1px" borderColor="surface.border">
              Navigate
            </DrawerHeader>
            <DrawerBody>
              <Text fontSize="sm" color="surface.muted" mb={3}>
                Local-first simulation shell
              </Text>
              <Flex justify="flex-end" mb={2}>
                <ColorModeToggle />
              </Flex>
              <CurrencySelector id="app-display-currency-drawer" />
              <Divider borderColor="surface.border" my={3} />
              <TerminalNavLinks route={route} onNavigate={onClose} />
              <Divider borderColor="surface.border" my={3} />
              <PageNavLinks route={route} onNavigate={onClose} />
            </DrawerBody>
          </DrawerContent>
        </Drawer>

        <Box as="main" flex="1" p={{ base: 4, md: 8 }} overflow="auto">
          <HStack align="stretch" spacing={4} mb={6}>
            <WorkerStatusBanner />
          </HStack>
          {content}
        </Box>
      </Flex>
    </Flex>
  )
}

export type { AppRoute }
