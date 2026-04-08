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

const ROUTES = [
  { path: '/terminal', label: 'Terminal' },
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/strategies', label: 'Strategies' },
  { path: '/metrics', label: 'Metrics' },
  { path: '/connect', label: 'Connect' },
] as const

type AppRoutePath = (typeof ROUTES)[number]['path']

const DEFAULT_ROUTE: AppRoutePath = '/terminal'

const parseRouteFromHash = (hash: string): AppRoutePath => {
  const routeCandidate = hash.replace('#', '')
  if (ROUTES.some((route) => route.path === routeCandidate)) {
    return routeCandidate as AppRoutePath
  }
  return DEFAULT_ROUTE
}

const renderRoute = (route: AppRoutePath) => {
  if (route === '/portfolio') return <PortfolioPage />
  if (route === '/strategies') return <StrategiesPage />
  if (route === '/metrics') return <MetricsPage />
  if (route === '/connect') return <ConnectPage />
  return <TerminalPage />
}

const NavLinks = ({ route, onNavigate }: { route: AppRoutePath; onNavigate?: () => void }) => (
  <VStack as="nav" aria-label="Primary" align="stretch" spacing={1}>
    {ROUTES.map((item) => (
      <Link
        key={item.path}
        href={`#${item.path}`}
        px={3}
        py={2}
        borderRadius="md"
        bg={route === item.path ? 'brand.100' : 'transparent'}
        _hover={{ textDecoration: 'none', bg: 'surface.hover' }}
        _focusVisible={{ boxShadow: 'outline' }}
        fontWeight={route === item.path ? 'semibold' : 'medium'}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    ))}
  </VStack>
)

export const App = () => {
  const [route, setRoute] = useState<AppRoutePath>(() => parseRouteFromHash(window.location.hash))
  const { isOpen, onOpen, onClose } = useDisclosure()

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = DEFAULT_ROUTE
      setRoute(DEFAULT_ROUTE)
      return
    }

    const onHashChange = () => {
      setRoute(parseRouteFromHash(window.location.hash))
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
          <CurrencySelector id="app-display-currency-sidebar" />
          <Divider borderColor="surface.border" />
          <NavLinks route={route} />
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
              <CurrencySelector id="app-display-currency-drawer" />
              <Divider borderColor="surface.border" my={3} />
              <NavLinks route={route} onNavigate={onClose} />
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
