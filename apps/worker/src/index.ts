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

import { registerApi } from "./api";

const app = express();
const port = 4000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", app: getAppName() });
});

registerApi(app);

app.listen(port, () => {
  console.log(`Worker listening on port ${port}`);
});

const handleShutdown = () => {
  strategyRuntime.shutdown();
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);
