import express from "express";
import {
  LocalPersistence,
  createPersistentEngineState,
  persistExecutionResult,
  persistRuntimeState,
  rehydrateFromStorage,
} from "./storage";
import { createDeterministicExecutionContext } from "./engine/determinism";
import { PaperExecutionEngine } from "./engine/paperExecutionEngine";
import { createVenueAdapterRegistry } from "./adapters";
import { createApiRouter } from "./api/router";
import { StrategyRuntimeManager } from "./strategy/runtime";

const app = express();
const port = 4000;

const DEFAULT_BALANCE_STATE = {
  baseCurrency: "USD",
  cash: 100000,
  buyingPower: 100000,
  equity: 100000,
  holdings: [],
};

const persistence = new LocalPersistence({
  dataDirectory: process.env.WORKER_STORAGE_DIR ?? "apps/worker/.data",
});

const rehydrated = rehydrateFromStorage(persistence, DEFAULT_BALANCE_STATE);
const executionContext = createDeterministicExecutionContext({
  seed: Number(process.env.WORKER_DETERMINISTIC_SEED ?? "42"),
  startTime: process.env.WORKER_DETERMINISTIC_START_TIME ?? "2026-01-01T00:00:00.000Z",
  clockStepMs: Number(process.env.WORKER_DETERMINISTIC_CLOCK_STEP_MS ?? "1"),
});

const engine = new PaperExecutionEngine({
  context: executionContext,
  baseCurrency: rehydrated.state.balances.baseCurrency,
  cash: rehydrated.state.balances.cash,
  buyingPower: rehydrated.state.balances.buyingPower,
  holdings: rehydrated.state.balances.holdings,
});

let runtime = createPersistentEngineState(
  {
    orders: rehydrated.state.orders,
    fills: rehydrated.state.fills,
    strategyRuns: rehydrated.state.strategyRuns,
  },
  rehydrated.nextSequence,
);

const adapters = createVenueAdapterRegistry(engine, ({ result, events }) => {
  runtime = persistExecutionResult(persistence, runtime, engine.getState(), result, events);
});

const persistRuntime = (nextRuntime: typeof runtime): void => {
  runtime = nextRuntime;
  persistRuntimeState(persistence, {
    balances: engine.getState(),
    orders: runtime.orders,
    fills: runtime.fills,
    strategyRuns: runtime.strategyRuns,
  });
};

const strategyRuntime = new StrategyRuntimeManager({
  executionContext,
  adapters,
  getRuntime: () => runtime,
  persistRuntime,
});

if (rehydrated.recoveryEvents.length > 0) {
  for (const recoveryEvent of rehydrated.recoveryEvents) {
    console.error(
      `[ledger-recovery] line=${recoveryEvent.lineNumber} message=${recoveryEvent.message} raw=${recoveryEvent.rawRecord}`,
    );
  }
}

app.use(express.json());
app.use(
  "/api",
  createApiRouter({
    engine,
    adapters,
    executionContext,
    strategyRuntime,
    getRuntime: () => runtime,
    setRuntime: persistRuntime,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Worker listening on port ${port}`);
});

const handleShutdown = () => {
  strategyRuntime.shutdown();
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);
