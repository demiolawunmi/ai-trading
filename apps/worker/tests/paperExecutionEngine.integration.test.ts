import { describe, expect, it } from "vitest";
import { createDeterministicExecutionContext } from "../src/engine/determinism";
import { PaperExecutionEngine, REJECTION_CODES } from "../src/engine/paperExecutionEngine";

describe("paper execution engine integration", () => {
  it("rejects with INSUFFICIENT_BUYING_POWER when buy cost exceeds available buying power", () => {
    const engine = new PaperExecutionEngine({
      context: createDeterministicExecutionContext({
        seed: 42,
        startTime: "2026-01-01T00:00:00.000Z",
        clockStepMs: 1,
      }),
      baseCurrency: "USD",
      cash: 100,
      buyingPower: 100,
      holdings: [],
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
});
