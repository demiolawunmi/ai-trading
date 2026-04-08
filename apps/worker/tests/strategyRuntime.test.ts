import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { QuoteRequest, Venue } from "@ai-trading/domain";

import { createDeterministicExecutionContext } from "../src/engine/determinism";
import {
  LocalPersistence,
  createPersistentEngineState,
  persistRuntimeState,
  rehydrateFromStorage,
} from "../src/storage";
import { StrategyRuntimeError, StrategyRuntimeManager } from "../src/strategy/runtime";

const DEFAULT_BALANCE_STATE = {
  baseCurrency: "USD",
  cash: 100000,
  buyingPower: 100000,
  equity: 100000,
  holdings: [],
};

const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const createStubAdapters = () => {
  const getQuote = async (request: QuoteRequest) => {
    return {
      venue: request.venue,
      symbol: request.symbol,
      bid: 100,
      ask: 101,
      last: 100.5,
      timestamp: "2026-01-01T00:00:00.000Z",
    };
  };

  const adapters: Record<Venue, { getQuote(request: QuoteRequest): Promise<unknown> }> = {
    stocks: { getQuote },
    crypto: { getQuote },
    jupiter: { getQuote },
    polymarket: { getQuote },
  };

  return adapters;
};

describe("strategy runtime manager", () => {
  const runtimesToStop: StrategyRuntimeManager[] = [];

  afterEach(() => {
    for (const runtime of runtimesToStop) {
      runtime.shutdown();
    }
    runtimesToStop.length = 0;
  });

  it("supports registered -> running -> stopped lifecycle", async () => {
    const context = createDeterministicExecutionContext({
      seed: 42,
      startTime: "2026-03-01T00:00:00.000Z",
      clockStepMs: 1,
    });

    let runtime = createPersistentEngineState(
      {
        orders: [],
        fills: [],
        strategyRuns: [],
      },
      1,
    );

    const strategyRuntime = new StrategyRuntimeManager({
      executionContext: context,
      adapters: createStubAdapters(),
      getRuntime: () => runtime,
      persistRuntime: (nextRuntime) => {
        runtime = nextRuntime;
      },
    });
    runtimesToStop.push(strategyRuntime);

    const registered = strategyRuntime.register({
      strategyId: "mean-reversion",
      symbol: "AAPL",
      venue: "stocks",
      heartbeatIntervalMs: 5,
    });

    expect(registered.status).toBe("registered");

    const running = strategyRuntime.start("mean-reversion");
    expect(running.status).toBe("running");

    await sleep(15);
    const statusWhileRunning = strategyRuntime.getStatus("mean-reversion");
    expect(statusWhileRunning?.status).toBe("running");

    const stopped = strategyRuntime.stop("mean-reversion");
    expect(stopped.status).toBe("stopped");
    expect(stopped.stoppedAt).toBeDefined();
  });

  it("enforces one active instance per strategyId by default", () => {
    const context = createDeterministicExecutionContext({
      seed: 42,
      startTime: "2026-03-01T00:00:00.000Z",
      clockStepMs: 1,
    });

    let runtime = createPersistentEngineState(
      {
        orders: [],
        fills: [],
        strategyRuns: [],
      },
      1,
    );

    const strategyRuntime = new StrategyRuntimeManager({
      executionContext: context,
      adapters: createStubAdapters(),
      getRuntime: () => runtime,
      persistRuntime: (nextRuntime) => {
        runtime = nextRuntime;
      },
    });
    runtimesToStop.push(strategyRuntime);

    strategyRuntime.register({ strategyId: "trend" });
    strategyRuntime.start("trend");

    expect(() => strategyRuntime.start("trend")).toThrowError(StrategyRuntimeError);

    try {
      strategyRuntime.start("trend");
    } catch (error) {
      const runtimeError = error as StrategyRuntimeError;
      expect(runtimeError.code).toBe("STRATEGY_ALREADY_RUNNING");
    }
  });

  it("marks run as failed on runtime exception and keeps manager healthy", async () => {
    const context = createDeterministicExecutionContext({
      seed: 42,
      startTime: "2026-03-01T00:00:00.000Z",
      clockStepMs: 1,
    });

    let runtime = createPersistentEngineState(
      {
        orders: [],
        fills: [],
        strategyRuns: [],
      },
      1,
    );

    const strategyRuntime = new StrategyRuntimeManager({
      executionContext: context,
      adapters: createStubAdapters(),
      getRuntime: () => runtime,
      persistRuntime: (nextRuntime) => {
        runtime = nextRuntime;
      },
    });
    runtimesToStop.push(strategyRuntime);

    strategyRuntime.register({
      strategyId: "broken",
      heartbeatIntervalMs: 5,
      failOnHeartbeat: true,
    });

    strategyRuntime.start("broken");
    await sleep(20);

    const failedRun = strategyRuntime.getStatus("broken");
    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.failureReason).toContain("Configured strategy failure");

    const healthyRun = strategyRuntime.start("healthy-strategy");
    expect(healthyRun.status).toBe("running");
  });

  it("restores run metadata from persistence and allows manual restart", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "worker-strategy-runtime-"));

    try {
      const persistence = new LocalPersistence({
        dataDirectory: tempDir,
      });

      persistRuntimeState(persistence, {
        balances: DEFAULT_BALANCE_STATE,
        orders: [],
        fills: [],
        strategyRuns: [
          {
            id: "run-0001",
            strategyId: "carry",
            status: "running",
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.001Z",
            startedAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      });

      const rehydrated = rehydrateFromStorage(persistence, DEFAULT_BALANCE_STATE);
      let runtime = createPersistentEngineState(
        {
          orders: rehydrated.state.orders,
          fills: rehydrated.state.fills,
          strategyRuns: rehydrated.state.strategyRuns,
        },
        rehydrated.nextSequence,
      );

      const context = createDeterministicExecutionContext({
        seed: 42,
        startTime: "2026-03-01T00:00:00.000Z",
        clockStepMs: 1,
      });

      const strategyRuntime = new StrategyRuntimeManager({
        executionContext: context,
        adapters: createStubAdapters(),
        getRuntime: () => runtime,
        persistRuntime: (nextRuntime) => {
          runtime = nextRuntime;
          persistRuntimeState(persistence, {
            balances: DEFAULT_BALANCE_STATE,
            orders: runtime.orders,
            fills: runtime.fills,
            strategyRuns: runtime.strategyRuns,
          });
        },
      });
      runtimesToStop.push(strategyRuntime);

      const restoredStatus = strategyRuntime.getStatus("carry");
      expect(restoredStatus?.status).toBe("stopped");

      const restarted = strategyRuntime.start("carry");
      expect(restarted.status).toBe("running");

      const stopped = strategyRuntime.stop("carry");
      expect(stopped.status).toBe("stopped");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
