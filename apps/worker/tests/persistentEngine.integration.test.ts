import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDeterministicExecutionContext } from "../src/engine/determinism";
import { PaperExecutionEngine } from "../src/engine/paperExecutionEngine";
import {
  LocalPersistence,
  SNAPSHOT_VERSION,
  createPersistentEngineState,
  persistExecutionResult,
  rehydrateFromStorage,
  replayFromLedger,
} from "../src/storage";

const initialBalances = {
  baseCurrency: "USD",
  cash: 100000,
  buyingPower: 100000,
  equity: 100000,
  holdings: [],
};

const createTempDir = (): string => mkdtempSync(join(tmpdir(), "worker-persistent-engine-"));

describe("persistent engine + replay integration", () => {
  let directory: string;

  beforeEach(() => {
    directory = createTempDir();
  });

  afterEach(() => {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it("restores state after restart from persisted ledger + snapshot", () => {
    const persistence = new LocalPersistence({ dataDirectory: directory });
    const engine = new PaperExecutionEngine({
      context: createDeterministicExecutionContext({
        seed: 42,
        startTime: "2026-02-01T00:00:00.000Z",
        clockStepMs: 1,
      }),
      baseCurrency: "USD",
      cash: 100000,
      buyingPower: 100000,
      holdings: [],
    });

    let runtime = createPersistentEngineState(
      {
        orders: [],
        fills: [],
        strategyRuns: [],
      },
      1,
    );

    const first = engine.executeMarketOrder({
      order: {
        venue: "stocks",
        symbol: "AAPL",
        side: "buy",
        quantity: 10,
      },
      quotePrice: 125,
    });

    runtime = persistExecutionResult(
      persistence,
      runtime,
      engine.getState(),
      first.result,
      first.events,
    );

    const second = engine.executeMarketOrder({
      order: {
        venue: "stocks",
        symbol: "AAPL",
        side: "sell",
        quantity: 2,
      },
      quotePrice: 128,
    });

    runtime = persistExecutionResult(
      persistence,
      runtime,
      engine.getState(),
      second.result,
      second.events,
    );

    expect(runtime.nextSequence).toBeGreaterThan(1);

    const restarted = rehydrateFromStorage(persistence, initialBalances);
    const replayed = replayFromLedger(persistence, initialBalances);

    expect(restarted.recoveryEvents).toHaveLength(0);
    expect(restarted.state.balances).toEqual(engine.getState());
    expect(replayed.balances).toEqual(engine.getState());
    expect(restarted.state.orders).toHaveLength(2);
    expect(restarted.state.fills.length).toBeGreaterThan(0);
  });

  it("records sequence corruption and continues from valid records", () => {
    const persistence = new LocalPersistence({ dataDirectory: directory });

    const validPortfolioA = {
      version: SNAPSHOT_VERSION,
      sequence: 1,
      event: {
        type: "PortfolioUpdated",
        correlationId: "corr-1",
        timestamp: "2026-02-01T00:00:00.000Z",
        payload: {
          baseCurrency: "USD",
          cash: 99900,
          buyingPower: 99900,
          positions: [],
        },
      },
    };

    const duplicatedSequence = {
      version: SNAPSHOT_VERSION,
      sequence: 1,
      event: {
        type: "PortfolioUpdated",
        correlationId: "corr-dup",
        timestamp: "2026-02-01T00:00:00.001Z",
        payload: {
          baseCurrency: "USD",
          cash: 70000,
          buyingPower: 70000,
          positions: [],
        },
      },
    };

    const validPortfolioB = {
      version: SNAPSHOT_VERSION,
      sequence: 2,
      event: {
        type: "PortfolioUpdated",
        correlationId: "corr-2",
        timestamp: "2026-02-01T00:00:00.002Z",
        payload: {
          baseCurrency: "USD",
          cash: 99800,
          buyingPower: 99800,
          positions: [],
        },
      },
    };

    writeFileSync(
      persistence.ledgerPath,
      `${JSON.stringify(validPortfolioA)}\n${JSON.stringify(duplicatedSequence)}\n${JSON.stringify(validPortfolioB)}\n`,
      "utf8",
    );

    const restored = rehydrateFromStorage(persistence, initialBalances);
    expect(restored.recoveryEvents.length).toBeGreaterThan(0);
    expect(restored.recoveryEvents.some((event) => event.message.includes("LEDGER_SEQUENCE_CORRUPTION"))).toBe(true);
    expect(restored.state.balances.cash).toBe(99800);
  });
});
