import { describe, expect, it } from "vitest";
import type { FillComplete, Holding, StrategyRun } from "@ai-trading/domain";

import { computeAccountAnalytics, computeStrategyAnalytics } from "../src/metrics/analytics";

const accountFills: FillComplete[] = [
  {
    type: "FillComplete",
    correlationId: "corr-001",
    timestamp: "2026-03-01T09:30:00.000Z",
    payload: {
      orderId: "ord-001",
      venue: "stocks",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      averagePrice: 100,
    },
  },
  {
    type: "FillComplete",
    correlationId: "corr-002",
    timestamp: "2026-03-01T09:35:00.000Z",
    payload: {
      orderId: "ord-002",
      venue: "stocks",
      symbol: "AAPL",
      side: "sell",
      quantity: 6,
      averagePrice: 110,
    },
  },
  {
    type: "FillComplete",
    correlationId: "corr-003",
    timestamp: "2026-03-01T09:40:00.000Z",
    payload: {
      orderId: "ord-003",
      venue: "stocks",
      symbol: "MSFT",
      side: "buy",
      quantity: 5,
      averagePrice: 200,
    },
  },
  {
    type: "FillComplete",
    correlationId: "corr-004",
    timestamp: "2026-03-01T09:45:00.000Z",
    payload: {
      orderId: "ord-004",
      venue: "stocks",
      symbol: "MSFT",
      side: "sell",
      quantity: 2,
      averagePrice: 195,
    },
  },
];

const holdingsWithMarks: Holding[] = [
  {
    venue: "stocks",
    symbol: "AAPL",
    quantity: 4,
    averageCost: 100,
    marketPrice: 108,
  },
  {
    venue: "stocks",
    symbol: "MSFT",
    quantity: 3,
    averageCost: 200,
    marketPrice: 205,
  },
];

describe("metrics analytics", () => {
  it("computes deterministic account metrics with exact expected values", () => {
    const result = computeAccountAnalytics(accountFills, holdingsWithMarks, 100130);

    expect(result.metrics).toEqual({
      realizedPnl: 50,
      unrealizedPnl: 47,
      totalEquity: 100130,
      maxDrawdown: 10,
      winRate: 0.5,
      exposure: 0.01045641,
      sharpeLikeRatio: 1.01015254,
    });
    expect(result.warnings).toEqual([]);
    expect(result.summary).toEqual({
      hasActivity: true,
      closedTrades: 2,
      fillCount: 4,
    });
  });

  it("returns partial-data warning when a mark price is missing and excludes that symbol from unrealized + exposure", () => {
    const holdingsMissingMark: Holding[] = [
      {
        venue: "stocks",
        symbol: "AAPL",
        quantity: 4,
        averageCost: 100,
        marketPrice: 108,
      },
      {
        venue: "stocks",
        symbol: "MSFT",
        quantity: 3,
        averageCost: 200,
      },
    ];

    const result = computeAccountAnalytics(accountFills, holdingsMissingMark, 100130);

    expect(result.metrics.unrealizedPnl).toBe(32);
    expect(result.metrics.exposure).toBe(0.00431439);
    expect(result.warnings).toEqual([
      {
        code: "MISSING_MARK_PRICE",
        message:
          "One or more symbols are missing mark price; unrealized PnL and exposure exclude those symbols.",
        symbols: ["stocks:MSFT"],
      },
    ]);
  });

  it("filters strategy metrics by strategy-run time window", () => {
    const strategyRun: StrategyRun = {
      id: "run-001",
      strategyId: "momentum-v1",
      status: "stopped",
      createdAt: "2026-03-01T09:32:00.000Z",
      updatedAt: "2026-03-01T09:46:00.000Z",
      startedAt: "2026-03-01T09:33:00.000Z",
      stoppedAt: "2026-03-01T09:46:00.000Z",
    };

    const result = computeStrategyAnalytics(accountFills, holdingsWithMarks, 100130, strategyRun);

    expect(result.metrics).toEqual({
      realizedPnl: -10,
      unrealizedPnl: 15,
      totalEquity: 100130,
      maxDrawdown: 10,
      winRate: 0,
      exposure: 0.615,
      sharpeLikeRatio: 0,
    });
    expect(result.summary).toEqual({
      hasActivity: true,
      closedTrades: 1,
      fillCount: 3,
    });
  });
});
