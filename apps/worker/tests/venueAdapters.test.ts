import { describe, expect, it } from "vitest";

import type { MarketOrderRequest, QuoteRequest, Venue } from "@ai-trading/domain";

import { createDeterministicExecutionContext } from "../src/engine/determinism";
import { PaperExecutionEngine } from "../src/engine/paperExecutionEngine";
import {
  ADAPTER_ERROR_CODES,
  createVenueAdapterRegistry,
} from "../src/adapters";

const buildRegistry = () => {
  const engine = new PaperExecutionEngine({
    context: createDeterministicExecutionContext({
      seed: 42,
      startTime: "2026-01-01T00:00:00.000Z",
      clockStepMs: 1,
    }),
    baseCurrency: "USD",
    cash: 100_000,
    buyingPower: 100_000,
    holdings: [
      {
        venue: "stocks",
        symbol: "AAPL",
        quantity: 10,
        averageCost: 100,
        marketPrice: 100,
      },
      {
        venue: "crypto",
        symbol: "BTCUSD",
        quantity: 1,
        averageCost: 35_000,
        marketPrice: 35_000,
      },
      {
        venue: "jupiter",
        symbol: "SOL/USDC",
        quantity: 10,
        averageCost: 120,
        marketPrice: 120,
      },
      {
        venue: "polymarket",
        symbol: "PM-ELECTION-YES",
        quantity: 20,
        averageCost: 0.55,
        marketPrice: 0.55,
      },
    ],
  });

  return createVenueAdapterRegistry(engine);
};

const happyRequests: Record<Venue, MarketOrderRequest> = {
  stocks: {
    venue: "stocks",
    symbol: "AAPL",
    side: "buy",
    quantity: 1,
  },
  crypto: {
    venue: "crypto",
    symbol: "BTCUSD",
    side: "buy",
    quantity: 0.001,
  },
  jupiter: {
    venue: "jupiter",
    symbol: "SOL/USDC",
    side: "buy",
    quantity: 0.01,
  },
  polymarket: {
    venue: "polymarket",
    symbol: "PM-ELECTION-YES",
    side: "buy",
    quantity: 1,
  },
};

const invalidSymbolRequests: Record<Venue, QuoteRequest> = {
  stocks: {
    venue: "stocks",
    symbol: "AAPL/USD",
  },
  crypto: {
    venue: "crypto",
    symbol: "BTC/USD",
  },
  jupiter: {
    venue: "jupiter",
    symbol: "SOLUSDC",
  },
  polymarket: {
    venue: "polymarket",
    symbol: "PMBAD",
  },
};

const invalidSizeRequests: Record<Venue, MarketOrderRequest> = {
  stocks: {
    venue: "stocks",
    symbol: "AAPL",
    side: "buy",
    quantity: 0.5,
  },
  crypto: {
    venue: "crypto",
    symbol: "BTCUSD",
    side: "buy",
    quantity: 0.00005,
  },
  jupiter: {
    venue: "jupiter",
    symbol: "SOL/USDC",
    side: "buy",
    quantity: 0.00005,
  },
  polymarket: {
    venue: "polymarket",
    symbol: "PM-ELECTION-YES",
    side: "buy",
    quantity: 0.5,
  },
};

describe("simulated venue adapters", () => {
  it.each(["stocks", "crypto", "jupiter", "polymarket"] as const)(
    "%s adapter supports deterministic quote + happy-path order",
    async (venue) => {
      const registry = buildRegistry();
      const adapter = registry[venue];

      const quoteA = await adapter.getQuote({
        venue,
        symbol: happyRequests[venue].symbol,
        quantity: happyRequests[venue].quantity,
      });
      const quoteB = await adapter.getQuote({
        venue,
        symbol: happyRequests[venue].symbol,
        quantity: happyRequests[venue].quantity,
      });

      expect(quoteB).toEqual(quoteA);

      const result = await adapter.placeMarketOrder(happyRequests[venue]);
      expect(result.status).toBe("accepted");
      expect(result.venue).toBe(venue);
      expect(result.orderId).toBeDefined();
    },
  );

  it.each(["stocks", "crypto", "jupiter", "polymarket"] as const)(
    "%s adapter normalizes invalid symbol failures",
    async (venue) => {
      const registry = buildRegistry();
      const adapter = registry[venue];

      await expect(adapter.getQuote(invalidSymbolRequests[venue])).rejects.toThrow(
        new RegExp(ADAPTER_ERROR_CODES.INVALID_SYMBOL),
      );
    },
  );

  it.each(["stocks", "crypto", "jupiter", "polymarket"] as const)(
    "%s adapter normalizes invalid order size failures",
    async (venue) => {
      const registry = buildRegistry();
      const adapter = registry[venue];

      const result = await adapter.placeMarketOrder(invalidSizeRequests[venue]);
      expect(result.status).toBe("rejected");
      expect(result.reasonCode).toBe(ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE);
    },
  );

  it("polymarket adapter normalizes venue closed behavior", async () => {
    const registry = buildRegistry();
    const adapter = registry.polymarket;

    const closedResult = await adapter.placeMarketOrder({
      venue: "polymarket",
      symbol: "PM-ELECTION-CLOSED-YES",
      side: "buy",
      quantity: 1,
    });

    expect(closedResult.status).toBe("rejected");
    expect(closedResult.reasonCode).toBe(ADAPTER_ERROR_CODES.VENUE_CLOSED);
  });
});
