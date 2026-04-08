import type { Venue } from '@ai-trading/domain'

export const TERMINAL_VENUES: Venue[] = ['stocks', 'crypto', 'jupiter', 'polymarket']

const PAGE_PATHS = ['/portfolio', '/strategies', '/metrics', '/connect'] as const
export type PagePath = (typeof PAGE_PATHS)[number]

export type AppRoute =
  | { kind: 'terminal'; venue: Venue }
  | { kind: 'page'; path: PagePath }

const isVenue = (value: string): value is Venue => TERMINAL_VENUES.includes(value as Venue)

const isPagePath = (value: string): value is PagePath =>
  (PAGE_PATHS as readonly string[]).includes(value)

/** Hash is `#/terminal/stocks` or `#/portfolio` (leading # optional). */
export function parseAppRoute(hash: string): AppRoute {
  const raw = hash.replace(/^#/, '').split('?')[0] || '/terminal/stocks'
  const path = raw.startsWith('/') ? raw : `/${raw}`

  if (path === '/terminal' || path === '/terminal/') {
    return { kind: 'terminal', venue: 'stocks' }
  }

  if (path.startsWith('/terminal/')) {
    const segment = path.split('/').filter(Boolean)[1] ?? 'stocks'
    return { kind: 'terminal', venue: isVenue(segment) ? segment : 'stocks' }
  }

  if (isPagePath(path)) {
    return { kind: 'page', path }
  }

  return { kind: 'terminal', venue: 'stocks' }
}

export function defaultHashForRoute(route: AppRoute): string {
  if (route.kind === 'terminal') return `#/terminal/${route.venue}`
  return `#${route.path}`
}
