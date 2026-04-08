import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MarketOrderRequest, QuoteRequest, Venue } from '@ai-trading/domain'

import { createApiRouter } from '../src/api/router'
import { createVenueAdapterRegistry } from '../src/adapters'
import { createDeterministicExecutionContext } from '../src/engine/determinism'
import { PaperExecutionEngine } from '../src/engine/paperExecutionEngine'
import { createPersistentEngineState, type PersistentEngineState } from '../src/storage'

const defaultBalances = {
  baseCurrency: 'USD',
  cash: 100000,
  buyingPower: 100000,
  equity: 100000,
  holdings: [],
}

const strategyRuntimeStub = {
  register: () => {
    throw new Error('not used')
  },
  start: () => {
    throw new Error('not used')
  },
  stop: () => {
    throw new Error('not used')
  },
  getStatus: () => undefined,
  listRuns: () => [],
}

describe('api resilience normalization', () => {
  let baseUrl = ''
  let runtime: PersistentEngineState
  let stopServer: (() => Promise<void>) | null = null

  beforeAll(async () => {
    const context = createDeterministicExecutionContext({
      seed: 42,
      startTime: '2026-01-01T00:00:00.000Z',
      clockStepMs: 1,
    })

    const engine = new PaperExecutionEngine({
      context,
      baseCurrency: defaultBalances.baseCurrency,
      cash: defaultBalances.cash,
      buyingPower: defaultBalances.buyingPower,
      holdings: defaultBalances.holdings,
    })

    runtime = createPersistentEngineState(
      {
        orders: [],
        fills: [],
        strategyRuns: [],
      },
      1,
    )

    const healthyAdapters = createVenueAdapterRegistry(engine)
    const adapters: Record<Venue, { getQuote(request: QuoteRequest): Promise<unknown>; placeMarketOrder(request: MarketOrderRequest): Promise<unknown> }> = {
      ...healthyAdapters,
      stocks: {
        ...healthyAdapters.stocks,
        async getQuote(request: QuoteRequest) {
          const symbol = request.symbol.trim().toUpperCase()
          if (symbol === 'RATE429') {
            throw new Error('RATE_LIMITED: Upstream adapter returned 429 rate limit')
          }

          if (symbol === 'TIMEOUT') {
            throw new Error('REQUEST_TIMEOUT: Upstream adapter request timed out')
          }

          return healthyAdapters.stocks.getQuote(request)
        },
      },
    }

    const app = express()
    app.use(express.json())
    app.use(
      '/api',
      createApiRouter({
        engine,
        adapters: adapters as never,
        executionContext: context,
        strategyRuntime: strategyRuntimeStub as never,
        getRuntime: () => runtime,
        setRuntime: (nextRuntime) => {
          runtime = nextRuntime
        },
      }),
    )
    app.get('/health', (_req, res) => res.json({ status: 'ok' }))

    const server = await new Promise<import('node:http').Server>((resolve) => {
      const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer))
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address for resilience test')
    }

    baseUrl = `http://127.0.0.1:${address.port}`
    stopServer = async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    }
  })

  afterAll(async () => {
    if (stopServer) {
      await stopServer()
    }
  })

  it('normalizes adapter 429 and timeout errors while worker stays healthy', async () => {
    const rateLimited = await fetch(`${baseUrl}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venue: 'stocks',
        symbol: 'RATE429',
        quantity: 1,
      }),
    })

    expect(rateLimited.status).toBe(400)
    const rateLimitedPayload = (await rateLimited.json()) as { error: { code: string; message: string } }
    expect(rateLimitedPayload.error.code).toBe('RATE_LIMITED')
    expect(rateLimitedPayload.error.message).toContain('429')

    const timedOut = await fetch(`${baseUrl}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venue: 'stocks',
        symbol: 'TIMEOUT',
        quantity: 1,
      }),
    })

    expect(timedOut.status).toBe(400)
    const timedOutPayload = (await timedOut.json()) as { error: { code: string; message: string } }
    expect(timedOutPayload.error.code).toBe('REQUEST_TIMEOUT')
    expect(timedOutPayload.error.message).toContain('timed out')

    const health = await fetch(`${baseUrl}/health`)
    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ status: 'ok' })

    const healthyQuote = await fetch(`${baseUrl}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venue: 'stocks',
        symbol: 'AAPL',
        quantity: 1,
      }),
    })

    expect(healthyQuote.status).toBe(200)
  })

  it('uses /api/quote as canonical endpoint and rejects deprecated plural path', async () => {
    const canonical = await fetch(`${baseUrl}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venue: 'stocks',
        symbol: 'AAPL',
        quantity: 1,
      }),
    })

    expect(canonical.status).toBe(200)

    const deprecated = await fetch(`${baseUrl}/api/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venue: 'stocks',
        symbol: 'AAPL',
        quantity: 1,
      }),
    })

    expect(deprecated.status).toBe(404)
  })
})
