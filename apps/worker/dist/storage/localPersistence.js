"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayFromLedger = exports.persistRuntimeState = exports.rehydrateFromStorage = exports.LocalPersistence = exports.SNAPSHOT_VERSION = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
exports.SNAPSHOT_VERSION = 1;
const RECOVERY_EVENT_TYPE = "LedgerRecoveryError";
const isObject = (value) => {
    return typeof value === "object" && value !== null;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalizeSymbol = (symbol) => symbol.trim().toUpperCase();
const roundToScale = (value, scale) => {
    const factor = 10 ** scale;
    return Math.round(value * factor) / factor;
};
const toHoldings = (positions) => {
    return positions.map((position) => ({
        venue: position.venue,
        symbol: normalizeSymbol(position.symbol),
        quantity: position.quantity,
        averageCost: position.averageEntryPrice,
        marketPrice: position.marketPrice,
    }));
};
const isDomainEventType = (value) => {
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
const parseJson = (value) => JSON.parse(value);
const createRecoveryEvent = (lineNumber, rawRecord, message) => {
    return {
        type: RECOVERY_EVENT_TYPE,
        timestamp: new Date().toISOString(),
        message,
        lineNumber,
        rawRecord,
    };
};
const migrateSnapshot = (document) => {
    if (!isObject(document)) {
        throw new Error("SNAPSHOT_INVALID: snapshot root must be an object");
    }
    const version = document.version;
    if (typeof version !== "number") {
        throw new Error("SNAPSHOT_INVALID: snapshot version must be a number");
    }
    if (version < exports.SNAPSHOT_VERSION) {
        throw new Error(`SNAPSHOT_MIGRATION_NOT_IMPLEMENTED: cannot migrate snapshot version ${version} to ${exports.SNAPSHOT_VERSION}`);
    }
    if (version > exports.SNAPSHOT_VERSION) {
        throw new Error(`SNAPSHOT_UNSUPPORTED_VERSION: snapshot version ${version} is newer than supported version ${exports.SNAPSHOT_VERSION}`);
    }
    return document;
};
const replayPortfolio = (baseBalances, events) => {
    const orders = [];
    const fills = [];
    const strategyRuns = new Map();
    let balances = clone(baseBalances);
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
class LocalPersistence {
    snapshotPath;
    ledgerPath;
    recoveryLogPath;
    constructor(options) {
        this.snapshotPath = (0, node_path_1.join)(options.dataDirectory, "snapshot.json");
        this.ledgerPath = (0, node_path_1.join)(options.dataDirectory, "ledger.ndjson");
        this.recoveryLogPath = (0, node_path_1.join)(options.dataDirectory, "ledger.recovery.ndjson");
        (0, node_fs_1.mkdirSync)(options.dataDirectory, { recursive: true });
    }
    loadSnapshot(fallbackBalances) {
        if (!(0, node_fs_1.existsSync)(this.snapshotPath)) {
            return {
                version: exports.SNAPSHOT_VERSION,
                balances: clone(fallbackBalances),
                orders: [],
                fills: [],
                strategyRuns: [],
                updatedAt: new Date(0).toISOString(),
            };
        }
        const raw = (0, node_fs_1.readFileSync)(this.snapshotPath, "utf8");
        const migrated = migrateSnapshot(parseJson(raw));
        return clone(migrated);
    }
    saveSnapshot(snapshot) {
        const parentDirectory = (0, node_path_1.dirname)(this.snapshotPath);
        (0, node_fs_1.mkdirSync)(parentDirectory, { recursive: true });
        (0, node_fs_1.writeFileSync)(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
    }
    appendLedgerEvents(events, startSequence) {
        if (events.length === 0) {
            return startSequence;
        }
        const lines = [];
        let sequence = startSequence;
        for (const event of events) {
            const record = {
                version: exports.SNAPSHOT_VERSION,
                sequence,
                event,
            };
            lines.push(JSON.stringify(record));
            sequence += 1;
        }
        (0, node_fs_1.appendFileSync)(this.ledgerPath, `${lines.join("\n")}\n`, "utf8");
        return sequence;
    }
    loadLedger() {
        if (!(0, node_fs_1.existsSync)(this.ledgerPath)) {
            return {
                events: [],
                recoveryEvents: [],
                nextSequence: 1,
            };
        }
        const lines = (0, node_fs_1.readFileSync)(this.ledgerPath, "utf8")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        const parsedRecords = [];
        const events = [];
        const recoveryEvents = [];
        let maxSequence = 0;
        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            try {
                const parsed = parseJson(line);
                if (!isObject(parsed)) {
                    throw new Error("record is not an object");
                }
                const sequence = parsed.sequence;
                if (typeof sequence !== "number" || sequence < 1) {
                    throw new Error("record sequence must be a positive number");
                }
                const version = parsed.version;
                if (version !== exports.SNAPSHOT_VERSION) {
                    throw new Error(`record version ${String(version)} is not supported`);
                }
                const event = parsed.event;
                if (!isObject(event) || !isDomainEventType(event.type)) {
                    throw new Error("record event has unknown or missing event type");
                }
                parsedRecords.push({
                    sequence,
                    event: event,
                    lineNumber: index + 1,
                });
                maxSequence = Math.max(maxSequence, sequence);
            }
            catch (error) {
                recoveryEvents.push(createRecoveryEvent(index + 1, line, error instanceof Error ? error.message : String(error)));
            }
        }
        parsedRecords.sort((left, right) => left.sequence - right.sequence);
        let lastSequence = 0;
        for (const record of parsedRecords) {
            if (record.sequence <= lastSequence) {
                recoveryEvents.push(createRecoveryEvent(record.lineNumber, `sequence=${record.sequence}`, `LEDGER_SEQUENCE_CORRUPTION: sequence ${record.sequence} is not strictly increasing after ${lastSequence}`));
                continue;
            }
            lastSequence = record.sequence;
            events.push(record.event);
        }
        if (recoveryEvents.length > 0) {
            const serialized = recoveryEvents.map((event) => JSON.stringify(event)).join("\n");
            (0, node_fs_1.appendFileSync)(this.recoveryLogPath, `${serialized}\n`, "utf8");
        }
        return {
            events,
            recoveryEvents,
            nextSequence: maxSequence + 1,
        };
    }
}
exports.LocalPersistence = LocalPersistence;
const rehydrateFromStorage = (persistence, fallbackBalances) => {
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
exports.rehydrateFromStorage = rehydrateFromStorage;
const persistRuntimeState = (persistence, runtimeState) => {
    persistence.saveSnapshot({
        version: exports.SNAPSHOT_VERSION,
        balances: clone(runtimeState.balances),
        orders: clone(runtimeState.orders),
        fills: clone(runtimeState.fills),
        strategyRuns: clone(runtimeState.strategyRuns),
        updatedAt: new Date().toISOString(),
    });
};
exports.persistRuntimeState = persistRuntimeState;
const replayFromLedger = (persistence, fallbackBalances) => {
    const ledger = persistence.loadLedger();
    const replay = replayPortfolio(fallbackBalances, ledger.events);
    return {
        balances: replay.balances,
        orders: replay.orders,
        fills: replay.fills,
        strategyRuns: replay.strategyRuns,
    };
};
exports.replayFromLedger = replayFromLedger;
