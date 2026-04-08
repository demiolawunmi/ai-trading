import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  BalanceState,
  DomainEvent,
  FillComplete,
  FillPartial,
  OrderResult,
  Position,
  StrategyRun,
} from "@ai-trading/domain";

export const SNAPSHOT_VERSION = 1;
const RECOVERY_EVENT_TYPE = "LedgerRecoveryError";

export interface LedgerRecoveryEvent {
  type: typeof RECOVERY_EVENT_TYPE;
  timestamp: string;
  message: string;
  lineNumber: number;
  rawRecord: string;
}

export interface PersistedWorkerSnapshot {
  version: number;
  balances: BalanceState;
  orders: OrderResult[];
  fills: Array<FillPartial | FillComplete>;
  strategyRuns: StrategyRun[];
  updatedAt: string;
}

interface LedgerRecord {
  version: number;
  sequence: number;
  event: DomainEvent;
}

interface ParsedLedgerRecord {
  sequence: number;
  event: DomainEvent;
  lineNumber: number;
}

export interface LocalPersistenceOptions {
  dataDirectory: string;
}

export interface LedgerLoadResult {
  events: DomainEvent[];
  recoveryEvents: LedgerRecoveryEvent[];
  nextSequence: number;
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeSymbol = (symbol: string): string => symbol.trim().toUpperCase();

const roundToScale = (value: number, scale: number): number => {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
};

const toHoldings = (positions: Position[]): BalanceState["holdings"] => {
  return positions.map((position) => ({
    venue: position.venue,
    symbol: normalizeSymbol(position.symbol),
    quantity: position.quantity,
    averageCost: position.averageEntryPrice,
    marketPrice: position.marketPrice,
  }));
};

const isDomainEventType = (value: unknown): value is DomainEvent["type"] => {
  if (typeof value !== "string") {
    return false;
  }

  return [
    "OrderRequested",
    "OrderAccepted",
    "OrderRejected",
    "FillPartial",
    "FillComplete",
    "PortfolioUpdated",
    "MetricsUpdated",
  ].includes(value);
};

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

const createRecoveryEvent = (
  lineNumber: number,
  rawRecord: string,
  message: string,
): LedgerRecoveryEvent => {
  return {
    type: RECOVERY_EVENT_TYPE,
    timestamp: new Date().toISOString(),
    message,
    lineNumber,
    rawRecord,
  };
};

const migrateSnapshot = (document: unknown): PersistedWorkerSnapshot => {
  if (!isObject(document)) {
    throw new Error("SNAPSHOT_INVALID: snapshot root must be an object");
  }

  const version = document.version;
  if (typeof version !== "number") {
    throw new Error("SNAPSHOT_INVALID: snapshot version must be a number");
  }

  if (version < SNAPSHOT_VERSION) {
    throw new Error(
      `SNAPSHOT_MIGRATION_NOT_IMPLEMENTED: cannot migrate snapshot version ${version} to ${SNAPSHOT_VERSION}`,
    );
  }

  if (version > SNAPSHOT_VERSION) {
    throw new Error(
      `SNAPSHOT_UNSUPPORTED_VERSION: snapshot version ${version} is newer than supported version ${SNAPSHOT_VERSION}`,
    );
  }

  return document as unknown as PersistedWorkerSnapshot;
};

const replayPortfolio = (
  baseBalances: BalanceState,
  events: DomainEvent[],
): {
  balances: BalanceState;
  orders: OrderResult[];
  fills: Array<FillPartial | FillComplete>;
  strategyRuns: StrategyRun[];
} => {
  const orders: OrderResult[] = [];
  const fills: Array<FillPartial | FillComplete> = [];
  const strategyRuns = new Map<string, StrategyRun>();
  let balances: BalanceState = clone(baseBalances);

  for (const event of events) {
    if (event.type === "OrderAccepted" || event.type === "OrderRejected") {
      orders.push(clone(event.payload));
    }

    if (event.type === "FillPartial" || event.type === "FillComplete") {
      fills.push(clone(event));
    }

    if (event.type === "MetricsUpdated" && event.payload.strategyRun) {
      strategyRuns.set(event.payload.strategyRun.id, clone(event.payload.strategyRun));
    }

    if (event.type === "PortfolioUpdated") {
      const positionsMarketValue = event.payload.positions.reduce((sum, p) => sum + p.marketValue, 0);
      balances = {
        baseCurrency: event.payload.baseCurrency,
        cash: roundToScale(event.payload.cash, 8),
        buyingPower: roundToScale(event.payload.buyingPower, 8),
        equity: roundToScale(event.payload.cash + positionsMarketValue, 8),
        holdings: toHoldings(event.payload.positions),
      };
    }
  }

  return {
    balances,
    orders,
    fills,
    strategyRuns: Array.from(strategyRuns.values()).sort((left, right) => left.id.localeCompare(right.id)),
  };
};

export class LocalPersistence {
  readonly snapshotPath: string;

  readonly ledgerPath: string;

  readonly recoveryLogPath: string;

  constructor(options: LocalPersistenceOptions) {
    this.snapshotPath = join(options.dataDirectory, "snapshot.json");
    this.ledgerPath = join(options.dataDirectory, "ledger.ndjson");
    this.recoveryLogPath = join(options.dataDirectory, "ledger.recovery.ndjson");
    mkdirSync(options.dataDirectory, { recursive: true });
  }

  loadSnapshot(fallbackBalances: BalanceState): PersistedWorkerSnapshot {
    if (!existsSync(this.snapshotPath)) {
      return {
        version: SNAPSHOT_VERSION,
        balances: clone(fallbackBalances),
        orders: [],
        fills: [],
        strategyRuns: [],
        updatedAt: new Date(0).toISOString(),
      };
    }

    const raw = readFileSync(this.snapshotPath, "utf8");
    const migrated = migrateSnapshot(parseJson<unknown>(raw));
    return clone(migrated);
  }

  saveSnapshot(snapshot: PersistedWorkerSnapshot): void {
    const parentDirectory = dirname(this.snapshotPath);
    mkdirSync(parentDirectory, { recursive: true });
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  }

  appendLedgerEvents(events: DomainEvent[], startSequence: number): number {
    if (events.length === 0) {
      return startSequence;
    }

    const lines: string[] = [];
    let sequence = startSequence;

    for (const event of events) {
      const record: LedgerRecord = {
        version: SNAPSHOT_VERSION,
        sequence,
        event,
      };
      lines.push(JSON.stringify(record));
      sequence += 1;
    }

    appendFileSync(this.ledgerPath, `${lines.join("\n")}\n`, "utf8");
    return sequence;
  }

  loadLedger(): LedgerLoadResult {
    if (!existsSync(this.ledgerPath)) {
      return {
        events: [],
        recoveryEvents: [],
        nextSequence: 1,
      };
    }

    const lines = readFileSync(this.ledgerPath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsedRecords: ParsedLedgerRecord[] = [];
    const events: DomainEvent[] = [];
    const recoveryEvents: LedgerRecoveryEvent[] = [];
    let maxSequence = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      try {
        const parsed = parseJson<unknown>(line);
        if (!isObject(parsed)) {
          throw new Error("record is not an object");
        }

        const sequence = parsed.sequence;
        if (typeof sequence !== "number" || sequence < 1) {
          throw new Error("record sequence must be a positive number");
        }

        const version = parsed.version;
        if (version !== SNAPSHOT_VERSION) {
          throw new Error(`record version ${String(version)} is not supported`);
        }

        const event = parsed.event;
        if (!isObject(event) || !isDomainEventType(event.type)) {
          throw new Error("record event has unknown or missing event type");
        }

        parsedRecords.push({
          sequence,
          event: event as unknown as DomainEvent,
          lineNumber: index + 1,
        });
        maxSequence = Math.max(maxSequence, sequence);
      } catch (error) {
        recoveryEvents.push(
          createRecoveryEvent(
            index + 1,
            line,
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    }

    parsedRecords.sort((left, right) => left.sequence - right.sequence);

    let lastSequence = 0;
    for (const record of parsedRecords) {
      if (record.sequence <= lastSequence) {
        recoveryEvents.push(
          createRecoveryEvent(
            record.lineNumber,
            `sequence=${record.sequence}`,
            `LEDGER_SEQUENCE_CORRUPTION: sequence ${record.sequence} is not strictly increasing after ${lastSequence}`,
          ),
        );
        continue;
      }

      lastSequence = record.sequence;
      events.push(record.event);
    }

    if (recoveryEvents.length > 0) {
      const serialized = recoveryEvents.map((event) => JSON.stringify(event)).join("\n");
      appendFileSync(this.recoveryLogPath, `${serialized}\n`, "utf8");
    }

    return {
      events,
      recoveryEvents,
      nextSequence: maxSequence + 1,
    };
  }
}

export interface PersistentRuntimeState {
  balances: BalanceState;
  orders: OrderResult[];
  fills: Array<FillPartial | FillComplete>;
  strategyRuns: StrategyRun[];
}

export interface RehydrateResult {
  state: PersistentRuntimeState;
  recoveryEvents: LedgerRecoveryEvent[];
  nextSequence: number;
}

export const rehydrateFromStorage = (
  persistence: LocalPersistence,
  fallbackBalances: BalanceState,
): RehydrateResult => {
  const snapshot = persistence.loadSnapshot(fallbackBalances);
  const ledger = persistence.loadLedger();
  const replay = replayPortfolio(snapshot.balances, ledger.events);

  return {
    state: {
      balances: replay.balances,
      orders: replay.orders.length > 0 ? replay.orders : snapshot.orders,
      fills: replay.fills.length > 0 ? replay.fills : snapshot.fills,
      strategyRuns: replay.strategyRuns.length > 0 ? replay.strategyRuns : snapshot.strategyRuns,
    },
    recoveryEvents: ledger.recoveryEvents,
    nextSequence: ledger.nextSequence,
  };
};

export const persistRuntimeState = (
  persistence: LocalPersistence,
  runtimeState: PersistentRuntimeState,
): void => {
  persistence.saveSnapshot({
    version: SNAPSHOT_VERSION,
    balances: clone(runtimeState.balances),
    orders: clone(runtimeState.orders),
    fills: clone(runtimeState.fills),
    strategyRuns: clone(runtimeState.strategyRuns),
    updatedAt: new Date().toISOString(),
  });
};

export const replayFromLedger = (
  persistence: LocalPersistence,
  fallbackBalances: BalanceState,
): PersistentRuntimeState => {
  const ledger = persistence.loadLedger();
  const replay = replayPortfolio(fallbackBalances, ledger.events);
  return {
    balances: replay.balances,
    orders: replay.orders,
    fills: replay.fills,
    strategyRuns: replay.strategyRuns,
  };
};
