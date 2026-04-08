import { describe, expect, it } from "vitest";
import { createDeterministicExecutionContext } from "../src/engine/determinism";
import { PaperExecutionEngine, REJECTION_CODES } from "../src/engine/paperExecutionEngine";

const createEngine = (seed: number, overrides?: Partial<ConstructorParameters<typeof PaperExecutionEngine>[0]>) => {
  const context = createDeterministicExecutionContext({
    seed,
    startTime: "2026-01-01T00:00:00.000Z",
    clockStepMs: 1,
  });

  return new PaperExecutionEngine({
    context,
    baseCurrency: "USD",
    cash: 10_000,
    buyingPower: 10_000,
    holdings: [],
    ...overrides,
  });
};

describe("paper execution engine", () => {
  it("produces byte-identical fill snapshots for deterministic replay with seed 42", () => {
    const runScenario = (): string => {
      const engine = createEngine(42);
      const outputs = [
        engine.executeMarketOrder({
          order: {
            venue: "stocks",
            symbol: "AAPL",
            side: "buy",
            notional: 1_250,
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
      ];

      const fillEvents = outputs
        .flatMap((output) => output.events)
        .filter((event) => event.type === "FillPartial" || event.type === "FillComplete");

      return JSON.stringify(fillEvents);
    };

    const first = runScenario();
    const second = runScenario();

    expect(second).toBe(first);
  });

  it("rejects buy orders when estimated notional exceeds buying power", () => {
    const engine = createEngine(42, {
      cash: 100,
      buyingPower: 100,
    });

    const output = engine.executeMarketOrder({
      order: {
        venue: "stocks",
        symbol: "AAPL",
        side: "buy",
        quantity: 2,
      },
      quotePrice: 75,
    });

    expect(output.result.status).toBe("rejected");
    expect(output.result.reasonCode).toBe(REJECTION_CODES.INSUFFICIENT_BUYING_POWER);
    expect(output.events.map((event) => event.type)).toEqual(["OrderRequested", "OrderRejected"]);
  });

  it("rejects sell orders when holdings are insufficient", () => {
    const engine = createEngine(42);

    const output = engine.executeMarketOrder({
      order: {
        venue: "stocks",
        symbol: "AAPL",
        side: "sell",
        quantity: 1,
      },
      quotePrice: 100,
    });

    expect(output.result.status).toBe("rejected");
    expect(output.result.reasonCode).toBe(REJECTION_CODES.INSUFFICIENT_HOLDINGS);
    expect(output.events.map((event) => event.type)).toEqual(["OrderRequested", "OrderRejected"]);
  });

  it("emits partial then complete fills when deterministic partial fill is enabled", () => {
    const engine = createEngine(7, {
      partialFillProbability: 1,
      maxSlippageBps: 10,
    });

    const output = engine.executeMarketOrder({
      order: {
        venue: "stocks",
        symbol: "MSFT",
        side: "buy",
        quantity: 10,
      },
      quotePrice: 300,
    });

    expect(output.result.status).toBe("accepted");
    expect(output.events.map((event) => event.type)).toEqual([
      "OrderRequested",
      "OrderAccepted",
      "FillPartial",
      "FillComplete",
      "PortfolioUpdated",
    ]);
  });

  it("emits complete fill without partial event when deterministic partial fill is disabled", () => {
    const engine = createEngine(7, {
      partialFillProbability: 0,
      maxSlippageBps: 10,
    });

    const output = engine.executeMarketOrder({
      order: {
        venue: "stocks",
        symbol: "MSFT",
        side: "buy",
        quantity: 10,
      },
      quotePrice: 300,
    });

    expect(output.result.status).toBe("accepted");
    expect(output.events.map((event) => event.type)).toEqual([
      "OrderRequested",
      "OrderAccepted",
      "FillComplete",
      "PortfolioUpdated",
    ]);
  });
});
