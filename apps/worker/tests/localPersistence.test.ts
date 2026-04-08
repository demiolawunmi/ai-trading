import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BalanceState, DomainEvent, StrategyRun } from "@ai-trading/domain";
import {
  LocalPersistence,
  SNAPSHOT_VERSION,
  persistRuntimeState,
  rehydrateFromStorage,
  replayFromLedger,
} from "../src/storage";

const fallbackBalances: BalanceState = {
  baseCurrency: "USD",
  cash: 100000,
  buyingPower: 100000,
  equity: 100000,
  holdings: [],
};

const createTempDir = (): string => mkdtempSync(join(tmpdir(), "worker-persistence-"));

const makeEvents = (): DomainEvent[] => {
  const baseTimestamp = "2026-02-01T00:00:00.000Z";

  return [
    {
      type: "OrderRequested",
      correlationId: "corr-1",
      timestamp: baseTimestamp,
      payload: {
        venue: "stocks",
        symbol: "AAPL",
        side: "buy",
        quantity: 2,
      },
    },
    {
      type: "OrderAccepted",
      correlationId: "corr-1",
      timestamp: "2026-02-01T00:00:00.001Z",
      payload: {
        status: "accepted",
        venue: "stocks",
        symbol: "AAPL",
        side: "buy",
        orderId: "ord-1",
        requestedQuantity: 2,
      },
    },
    {
      type: "FillComplete",
      correlationId: "corr-1",
      timestamp: "2026-02-01T00:00:00.002Z",
      payload: {
        orderId: "ord-1",
        venue: "stocks",
        symbol: "AAPL",
        side: "buy",
        quantity: 2,
        averagePrice: 100,
      },
    },
    {
      type: "PortfolioUpdated",
      correlationId: "corr-1",
      timestamp: "2026-02-01T00:00:00.003Z",
      payload: {
        baseCurrency: "USD",
        cash: 99800,
        buyingPower: 99800,
        positions: [
          {
            venue: "stocks",
            symbol: "AAPL",
            quantity: 2,
            averageEntryPrice: 100,
            marketPrice: 100,
            marketValue: 200,
            unrealizedPnl: 0,
          },
        ],
      },
    },
  ];
};

describe("local worker persistence", () => {
  let directory: string;

  beforeEach(() => {
    directory = createTempDir();
  });

  afterEach(() => {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // no-op cleanup best-effort
    }
  });

  it("persists and rehydrates balances/orders/fills/strategy runs from snapshot + ledger", () => {
    const persistence = new LocalPersistence({ dataDirectory: directory });
    const events = makeEvents();

    const strategyRun: StrategyRun = {
      id: "run-1",
      strategyId: "mean-reversion",
      status: "stopped",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.005Z",
    };

    const nextSequence = persistence.appendLedgerEvents(events, 1);
    expect(nextSequence).toBe(5);

    persistRuntimeState(persistence, {
      balances: fallbackBalances,
      orders: [
        {
          status: "accepted",
          venue: "stocks",
          symbol: "AAPL",
          side: "buy",
          orderId: "legacy-snapshot-order",
        },
      ],
      fills: [],
      strategyRuns: [strategyRun],
    });

    const restored = rehydrateFromStorage(persistence, fallbackBalances);

    expect(restored.recoveryEvents).toHaveLength(0);
    expect(restored.nextSequence).toBe(5);
    expect(restored.state.balances.cash).toBe(99800);
    expect(restored.state.balances.holdings).toEqual([
      {
        venue: "stocks",
        symbol: "AAPL",
        quantity: 2,
        averageCost: 100,
        marketPrice: 100,
      },
    ]);
    expect(restored.state.orders).toHaveLength(1);
    expect(restored.state.orders[0]?.orderId).toBe("ord-1");
    expect(restored.state.fills).toHaveLength(1);
    expect(restored.state.strategyRuns).toEqual([strategyRun]);
  });

  it("replays ledger deterministically into portfolio state", () => {
    const persistence = new LocalPersistence({ dataDirectory: directory });
    persistence.appendLedgerEvents(makeEvents(), 1);

    const replayed = replayFromLedger(persistence, fallbackBalances);

    expect(replayed.balances).toEqual({
      baseCurrency: "USD",
      cash: 99800,
      buyingPower: 99800,
      equity: 100000,
      holdings: [
        {
          venue: "stocks",
          symbol: "AAPL",
          quantity: 2,
          averageCost: 100,
          marketPrice: 100,
        },
      ],
    });
    expect(replayed.orders.map((order) => order.orderId)).toEqual(["ord-1"]);
  });

  it("handles malformed ledger records via explicit recovery event and safe continuation", () => {
    const persistence = new LocalPersistence({ dataDirectory: directory });
    const validRecord = {
      version: SNAPSHOT_VERSION,
      sequence: 1,
      event: makeEvents()[3],
    };

    writeFileSync(
      persistence.ledgerPath,
      `${JSON.stringify(validRecord)}\n{malformed-json\n${JSON.stringify({ version: SNAPSHOT_VERSION, sequence: 2, event: { type: "UnknownEvent" } })}\n`,
      "utf8",
    );

    const restored = rehydrateFromStorage(persistence, fallbackBalances);

    expect(restored.recoveryEvents).toHaveLength(2);
    expect(restored.recoveryEvents[0]?.type).toBe("LedgerRecoveryError");
    expect(restored.state.balances.cash).toBe(99800);
    expect(restored.state.balances.holdings).toHaveLength(1);
  });

  it("provides a migration stub error for older snapshot versions", () => {
    const persistence = new LocalPersistence({ dataDirectory: directory });
    writeFileSync(
      persistence.snapshotPath,
      JSON.stringify({
        version: SNAPSHOT_VERSION - 1,
        balances: fallbackBalances,
        orders: [],
        fills: [],
        strategyRuns: [],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    expect(() => rehydrateFromStorage(persistence, fallbackBalances)).toThrow(
      /SNAPSHOT_MIGRATION_NOT_IMPLEMENTED/,
    );
  });
});
