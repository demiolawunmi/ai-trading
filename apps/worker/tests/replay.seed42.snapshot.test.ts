import { describe, expect, it } from "vitest";
import { createDeterministicExecutionContext } from "../src/engine/determinism";
import { PaperExecutionEngine } from "../src/engine/paperExecutionEngine";

const runSeed42Scenario = (): string => {
  const engine = new PaperExecutionEngine({
    context: createDeterministicExecutionContext({
      seed: 42,
      startTime: "2026-01-01T00:00:00.000Z",
      clockStepMs: 1,
    }),
    baseCurrency: "USD",
    cash: 20_000,
    buyingPower: 20_000,
    holdings: [],
  });

  const scenarioOutputs = [
    engine.executeMarketOrder({
      order: {
        venue: "stocks",
        symbol: "AAPL",
        side: "buy",
        quantity: 10,
      },
      quotePrice: 125,
    }),
    engine.executeMarketOrder({
      order: {
        venue: "stocks",
        symbol: "AAPL",
        side: "sell",
        quantity: 2,
      },
      quotePrice: 128,
    }),
    engine.executeMarketOrder({
      order: {
        venue: "crypto",
        symbol: "BTCUSD",
        side: "buy",
        notional: 2_500,
      },
      quotePrice: 50_000,
    }),
  ];

  const fillEvents = scenarioOutputs
    .flatMap((output) => output.events)
    .filter((event) => event.type === "FillPartial" || event.type === "FillComplete");

  return JSON.stringify(fillEvents);
};

describe("deterministic replay snapshot", () => {
  it("seed 42 produces deterministic fill event snapshot", () => {
    const snapshot = runSeed42Scenario();
    expect(snapshot).toMatchInlineSnapshot(
      `"[{"type":"FillPartial","correlationId":"corr-000001","timestamp":"2026-01-01T00:00:00.055Z","payload":{"orderId":"ord-000002","venue":"stocks","symbol":"AAPL","side":"buy","quantity":3.85250018,"price":125.04830075,"remainingQuantity":6.14749982}},{"type":"FillComplete","correlationId":"corr-000001","timestamp":"2026-01-01T00:00:00.082Z","payload":{"orderId":"ord-000002","venue":"stocks","symbol":"AAPL","side":"buy","quantity":10,"averagePrice":124.91200802}},{"type":"FillComplete","correlationId":"corr-000003","timestamp":"2026-01-01T00:00:00.176Z","payload":{"orderId":"ord-000004","venue":"stocks","symbol":"AAPL","side":"sell","quantity":2,"averagePrice":127.7558144}},{"type":"FillComplete","correlationId":"corr-000005","timestamp":"2026-01-01T00:00:00.242Z","payload":{"orderId":"ord-000006","venue":"crypto","symbol":"BTCUSD","side":"buy","quantity":0.05,"averagePrice":50088.30068092}}]"`,
    );
  });
});
