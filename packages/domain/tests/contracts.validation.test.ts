import { describe, expect, it } from "vitest";
import {
  type DomainEvent,
  validateMarketOrderRequest,
  validatePortfolioUpdateRequest,
} from "../src";

describe("domain contract validation", () => {
  it("accepts valid market order payload and supports round-trip validation", () => {
    const payload = {
      venue: "stocks",
      symbol: "AAPL",
      side: "buy",
      notional: 100,
      clientOrderId: "order-1",
    };

    const firstPass = validateMarketOrderRequest(payload);
    expect(firstPass.success).toBe(true);
    expect(firstPass.issues).toHaveLength(0);

    if (!firstPass.success || !firstPass.data) {
      throw new Error("Expected market order payload to pass validation");
    }

    const secondPass = validateMarketOrderRequest(firstPass.data);
    expect(secondPass.success).toBe(true);
    expect(secondPass.issues).toHaveLength(0);
    expect(secondPass.data).toEqual(firstPass.data);
  });

  it("rejects malformed order side with explicit path", () => {
    const payload = {
      venue: "stocks",
      symbol: "AAPL",
      side: "hold",
      quantity: 1,
    };

    const result = validateMarketOrderRequest(payload);
    expect(result.success).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.side",
        }),
      ]),
    );
  });

  it("accepts valid portfolio update payload and supports round-trip validation", () => {
    const payload = {
      baseCurrency: "USD",
      cash: 10_000,
      buyingPower: 15_000,
      holdings: [
        {
          venue: "crypto",
          symbol: "BTCUSD",
          quantity: 0.5,
          averageCost: 60_000,
          marketPrice: 62_000,
        },
      ],
    };

    const firstPass = validatePortfolioUpdateRequest(payload);
    expect(firstPass.success).toBe(true);
    expect(firstPass.issues).toHaveLength(0);

    if (!firstPass.success || !firstPass.data) {
      throw new Error("Expected portfolio payload to pass validation");
    }

    const secondPass = validatePortfolioUpdateRequest(firstPass.data);
    expect(secondPass.success).toBe(true);
    expect(secondPass.issues).toHaveLength(0);
    expect(secondPass.data).toEqual(firstPass.data);
  });
});

describe("domain event contracts", () => {
  it("require deterministic metadata fields on every event shape", () => {
    const events: DomainEvent[] = [
      {
        type: "OrderRequested",
        timestamp: "2026-01-01T00:00:00.000Z",
        correlationId: "corr-1",
        payload: {
          venue: "stocks",
          symbol: "AAPL",
          side: "buy",
          quantity: 1,
        },
      },
      {
        type: "OrderAccepted",
        timestamp: "2026-01-01T00:00:00.000Z",
        correlationId: "corr-2",
        payload: {
          status: "accepted",
          venue: "stocks",
          symbol: "AAPL",
          side: "buy",
          orderId: "ord-1",
          requestedQuantity: 1,
        },
      },
      {
        type: "OrderRejected",
        timestamp: "2026-01-01T00:00:00.000Z",
        correlationId: "corr-3",
        payload: {
          status: "rejected",
          venue: "stocks",
          symbol: "AAPL",
          side: "buy",
          reasonCode: "INSUFFICIENT_BUYING_POWER",
          message: "Rejected",
        },
      },
      {
        type: "FillPartial",
        timestamp: "2026-01-01T00:00:00.000Z",
        correlationId: "corr-4",
        payload: {
          orderId: "ord-1",
          venue: "stocks",
          symbol: "AAPL",
          side: "buy",
          quantity: 0.5,
          price: 100,
          remainingQuantity: 0.5,
        },
      },
      {
        type: "FillComplete",
        timestamp: "2026-01-01T00:00:00.000Z",
        correlationId: "corr-5",
        payload: {
          orderId: "ord-1",
          venue: "stocks",
          symbol: "AAPL",
          side: "buy",
          quantity: 1,
          averagePrice: 100,
        },
      },
      {
        type: "PortfolioUpdated",
        timestamp: "2026-01-01T00:00:00.000Z",
        correlationId: "corr-6",
        payload: {
          baseCurrency: "USD",
          cash: 1_000,
          buyingPower: 2_000,
          positions: [],
        },
      },
      {
        type: "MetricsUpdated",
        timestamp: "2026-01-01T00:00:00.000Z",
        correlationId: "corr-7",
        payload: {
          metrics: {
            realizedPnl: 0,
            unrealizedPnl: 0,
            totalEquity: 1_000,
            maxDrawdown: 0,
            winRate: 0,
            exposure: 0,
          },
        },
      },
    ];

    for (const event of events) {
      expect(event.timestamp).toBe("2026-01-01T00:00:00.000Z");
      expect(event.correlationId).toMatch(/^corr-/);
    }
  });
});
