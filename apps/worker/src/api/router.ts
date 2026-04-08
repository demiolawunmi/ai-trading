import { Router, type Request, type Response } from "express";
import {
  VENUES,
  type FillComplete,
  type FillPartial,
  type Holding,
  type MarketOrderRequest,
  type OrderResult,
  type Position,
  type QuoteRequest,
  type Venue,
  validateMarketOrderRequest,
  validatePortfolioUpdateRequest,
} from "@ai-trading/domain";

import type { DeterministicExecutionContext } from "../engine/determinism";
import type { PaperExecutionEngine } from "../engine/paperExecutionEngine";
import type { PersistentEngineState } from "../storage";
import type { AdapterErrorCode } from "../adapters";
import { StrategyRuntimeError, type StrategyRuntimeManager } from "../strategy/runtime";
import {
  computeAccountAnalytics,
  computeStrategyAnalytics,
  type AnalyticsComputationResult,
  METRICS_WINDOWS,
  type MetricsWindow,
} from "../metrics/analytics";

type ConnectStatus = "connected" | "disconnected";

interface VenueConnectionState {
  venue: Venue;
  configured: boolean;
  status: ConnectStatus;
  updatedAt: string;
}

interface ConnectRecord {
  configured: boolean;
  status: ConnectStatus;
  updatedAt: string;
  maskedKeys: string[];
}

interface ApiDependencies {
  engine: PaperExecutionEngine;
  adapters: Record<Venue, { getQuote(request: QuoteRequest): Promise<unknown>; placeMarketOrder(request: MarketOrderRequest): Promise<OrderResult> }>;
  executionContext: DeterministicExecutionContext;
  strategyRuntime: StrategyRuntimeManager;
  getRuntime(): PersistentEngineState;
  setRuntime(nextRuntime: PersistentEngineState): void;
}

interface ValidationIssue {
  path: string;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const roundToScale = (value: number, scale: number): number => {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
};

const toPositions = (holdings: Holding[]): Position[] => {
  return holdings.map((holding) => {
    const marketPrice = holding.marketPrice ?? holding.averageCost;
    const marketValue = roundToScale(holding.quantity * marketPrice, 8);
    const unrealizedPnl = roundToScale((marketPrice - holding.averageCost) * holding.quantity, 8);

    return {
      venue: holding.venue,
      symbol: holding.symbol,
      quantity: holding.quantity,
      averageEntryPrice: holding.averageCost,
      marketPrice,
      marketValue,
      unrealizedPnl,
    };
  });
};

const parseAdapterError = (error: unknown): { code: AdapterErrorCode | "UNKNOWN_ERROR"; message: string } => {
  const text = error instanceof Error ? error.message : String(error);
  const match = /^([A-Z_]+):\s*(.+)$/u.exec(text);

  if (!match) {
    return {
      code: "UNKNOWN_ERROR",
      message: text,
    };
  }

  return {
    code: match[1] as AdapterErrorCode,
    message: match[2],
  };
};

const sendValidationError = (res: Response, issues: ValidationIssue[]): void => {
  res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid request payload",
      issues,
    },
  });
};

const sendBadRequest = (res: Response, code: string, message: string): void => {
  res.status(400).json({
    error: {
      code,
      message,
    },
  });
};

const isVenue = (value: unknown): value is Venue => {
  return typeof value === "string" && VENUES.includes(value as Venue);
};

const parseQuoteRequest = (body: unknown): { ok: true; data: QuoteRequest } | { ok: false; issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return {
      ok: false,
      issues: [{ path: "$", message: "must be an object" }],
    };
  }

  if (!isVenue(body.venue)) {
    issues.push({ path: "$.venue", message: `must be one of: ${VENUES.join(", ")}` });
  }

  if (typeof body.symbol !== "string" || body.symbol.trim().length === 0) {
    issues.push({ path: "$.symbol", message: "must be a non-empty string" });
  }

  if (body.quantity !== undefined && (!isFiniteNumber(body.quantity) || body.quantity <= 0)) {
    issues.push({ path: "$.quantity", message: "must be a finite number greater than 0 when provided" });
  }

  if (body.notional !== undefined && (!isFiniteNumber(body.notional) || body.notional <= 0)) {
    issues.push({ path: "$.notional", message: "must be a finite number greater than 0 when provided" });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const symbol = body.symbol as string;

  return {
    ok: true,
    data: {
      venue: body.venue as Venue,
      symbol: symbol.trim(),
      quantity: body.quantity as number | undefined,
      notional: body.notional as number | undefined,
    },
  };
};

const emptyConnection = (timestamp: string): ConnectRecord => ({
  configured: false,
  status: "disconnected",
  updatedAt: timestamp,
  maskedKeys: [],
});

export const createApiRouter = (dependencies: ApiDependencies): Router => {
  const router = Router();

  const connectState: Record<Venue, ConnectRecord> = {
    stocks: emptyConnection(dependencies.executionContext.nowIso()),
    crypto: emptyConnection(dependencies.executionContext.nowIso()),
    jupiter: emptyConnection(dependencies.executionContext.nowIso()),
    polymarket: emptyConnection(dependencies.executionContext.nowIso()),
  };

  const saveRuntime = (nextRuntime: PersistentEngineState): void => {
    dependencies.setRuntime(nextRuntime);
  };

  const mapStrategyErrorToStatus = (error: unknown): { status: number; code: string; message: string } => {
    if (!(error instanceof StrategyRuntimeError)) {
      return {
        status: 500,
        code: "STRATEGY_RUNTIME_ERROR",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    if (error.code === "STRATEGY_NOT_FOUND" || error.code === "VALIDATION_ERROR") {
      return {
        status: 400,
        code: error.code,
        message: error.message,
      };
    }

    if (error.code === "STRATEGY_ALREADY_RUNNING") {
      return {
        status: 409,
        code: error.code,
        message: error.message,
      };
    }

    return {
      status: 500,
      code: error.code,
      message: error.message,
    };
  };

  const saveConnection = (venue: Venue, credentials: Record<string, unknown>) => {
    const keys = Object.keys(credentials).filter((key) => {
      const value = credentials[key];
      return typeof value === "string" && value.trim().length > 0;
    });

    if (keys.length === 0) {
      return {
        ok: false as const,
        issues: [{ path: "$.credentials", message: "must include at least one non-empty value" }],
      };
    }

    const now = dependencies.executionContext.nowIso();
    connectState[venue] = {
      configured: true,
      status: "connected",
      updatedAt: now,
      maskedKeys: keys,
    };

    return {
      ok: true as const,
      response: {
        venue,
        configured: true,
        status: "connected" as const,
        updatedAt: now,
        credentialsStored: keys,
      },
    };
  };

  router.get("/connect/status", (_req, res) => {
    const venues: Record<Venue, VenueConnectionState> = {
      stocks: {
        venue: "stocks",
        configured: connectState.stocks.configured,
        status: connectState.stocks.status,
        updatedAt: connectState.stocks.updatedAt,
      },
      crypto: {
        venue: "crypto",
        configured: connectState.crypto.configured,
        status: connectState.crypto.status,
        updatedAt: connectState.crypto.updatedAt,
      },
      jupiter: {
        venue: "jupiter",
        configured: connectState.jupiter.configured,
        status: connectState.jupiter.status,
        updatedAt: connectState.jupiter.updatedAt,
      },
      polymarket: {
        venue: "polymarket",
        configured: connectState.polymarket.configured,
        status: connectState.polymarket.status,
        updatedAt: connectState.polymarket.updatedAt,
      },
    };

    res.json({ venues });
  });

  router.post("/connect/:venue", (req, res) => {
    const venue = req.params.venue;
    if (venue === "save") {
      if (!isRecord(req.body)) {
        sendValidationError(res, [{ path: "$", message: "must be an object" }]);
        return;
      }

      const saveVenue = req.body.venue;
      if (!isVenue(saveVenue)) {
        sendValidationError(res, [{ path: "$.venue", message: `must be one of: ${VENUES.join(", ")}` }]);
        return;
      }

      const saveCredentials = req.body.credentials;
      if (!isRecord(saveCredentials)) {
        sendValidationError(res, [{ path: "$.credentials", message: "must be an object" }]);
        return;
      }

      const saved = saveConnection(saveVenue, saveCredentials);
      if (!saved.ok) {
        sendValidationError(res, saved.issues);
        return;
      }

      res.json(saved.response);
      return;
    }

    if (!isVenue(venue)) {
      sendBadRequest(res, "INVALID_VENUE", `venue must be one of: ${VENUES.join(", ")}`);
      return;
    }

    if (!isRecord(req.body)) {
      sendValidationError(res, [{ path: "$", message: "must be an object" }]);
      return;
    }

    const credentials = req.body.credentials;
    if (!isRecord(credentials)) {
      sendValidationError(res, [{ path: "$.credentials", message: "must be an object" }]);
      return;
    }

    const saved = saveConnection(venue, credentials);
    if (!saved.ok) {
      sendValidationError(res, saved.issues);
      return;
    }

    res.json(saved.response);
  });

  router.get("/portfolio", (_req, res) => {
    res.json(dependencies.engine.getState());
  });

  router.patch("/portfolio", (req, res) => {
    const validation = validatePortfolioUpdateRequest(req.body);
    if (!validation.success || !validation.data) {
      sendValidationError(res, validation.issues);
      return;
    }

    dependencies.engine.replaceState({
      baseCurrency: validation.data.baseCurrency,
      cash: validation.data.cash,
      buyingPower: validation.data.buyingPower,
      equity: validation.data.cash,
      holdings: validation.data.holdings,
    });

    const runtime = dependencies.getRuntime();
    saveRuntime({
      ...runtime,
      orders: runtime.orders,
      fills: runtime.fills,
      strategyRuns: runtime.strategyRuns,
    });

    res.json(dependencies.engine.getState());
  });

  router.post("/quote", async (req, res) => {
    const parsed = parseQuoteRequest(req.body);
    if (!parsed.ok) {
      sendValidationError(res, parsed.issues);
      return;
    }

    try {
      const quote = await dependencies.adapters[parsed.data.venue].getQuote(parsed.data);
      res.json(quote);
    } catch (error) {
      const parsedError = parseAdapterError(error);
      sendBadRequest(res, parsedError.code, parsedError.message);
    }
  });

  router.post("/orders/market", async (req, res) => {
    const validation = validateMarketOrderRequest(req.body);
    if (!validation.success || !validation.data) {
      sendValidationError(res, validation.issues);
      return;
    }

    const beforeOrderCount = dependencies.getRuntime().orders.length;
    const result = await dependencies.adapters[validation.data.venue].placeMarketOrder(validation.data);
    const afterOrderCount = dependencies.getRuntime().orders.length;

    if (afterOrderCount === beforeOrderCount) {
      const runtime = dependencies.getRuntime();
      saveRuntime({
        ...runtime,
        orders: [...runtime.orders, result],
      });
    }

    res.json(result);
  });

  router.get("/positions", (_req, res) => {
    res.json({
      positions: toPositions(dependencies.engine.getState().holdings),
    });
  });

  router.get("/orders", (_req, res) => {
    res.json({
      orders: dependencies.getRuntime().orders,
    });
  });

  router.get("/fills", (_req, res) => {
    const fills: Array<FillPartial | FillComplete> = dependencies.getRuntime().fills;
    res.json({ fills });
  });

  router.post("/strategies/register", (req, res) => {
    if (!isRecord(req.body)) {
      sendValidationError(res, [{ path: "$", message: "must be an object" }]);
      return;
    }

    const strategyId = req.body.strategyId;
    if (typeof strategyId !== "string" || strategyId.trim().length === 0) {
      sendValidationError(res, [{ path: "$.strategyId", message: "must be a non-empty string" }]);
      return;
    }

    const venue = req.body.venue;
    if (venue !== undefined && !isVenue(venue)) {
      sendValidationError(res, [{ path: "$.venue", message: `must be one of: ${VENUES.join(", ")}` }]);
      return;
    }

    const symbol = req.body.symbol;
    if (symbol !== undefined && (typeof symbol !== "string" || symbol.trim().length === 0)) {
      sendValidationError(res, [{ path: "$.symbol", message: "must be a non-empty string when provided" }]);
      return;
    }

    const heartbeatIntervalMs = req.body.heartbeatIntervalMs;
    if (heartbeatIntervalMs !== undefined && (!isFiniteNumber(heartbeatIntervalMs) || heartbeatIntervalMs <= 0)) {
      sendValidationError(res, [{ path: "$.heartbeatIntervalMs", message: "must be a finite number greater than 0 when provided" }]);
      return;
    }

    const allowConcurrentInstances = req.body.allowConcurrentInstances;
    if (allowConcurrentInstances !== undefined && typeof allowConcurrentInstances !== "boolean") {
      sendValidationError(res, [{ path: "$.allowConcurrentInstances", message: "must be a boolean when provided" }]);
      return;
    }

    const failOnHeartbeat = req.body.failOnHeartbeat;
    if (failOnHeartbeat !== undefined && typeof failOnHeartbeat !== "boolean") {
      sendValidationError(res, [{ path: "$.failOnHeartbeat", message: "must be a boolean when provided" }]);
      return;
    }

    const created = dependencies.strategyRuntime.register({
      strategyId: strategyId.trim(),
      venue,
      symbol,
      heartbeatIntervalMs,
      allowConcurrentInstances,
      failOnHeartbeat,
    });

    res.json({ run: created });
  });

  router.post("/strategies/:strategyId/start", (req, res) => {
    const strategyId = req.params.strategyId;
    if (strategyId.trim().length === 0) {
      sendValidationError(res, [{ path: "$.strategyId", message: "must be a non-empty string" }]);
      return;
    }

    try {
      const started = dependencies.strategyRuntime.start(strategyId.trim());
      res.json({ run: started });
    } catch (error) {
      const mappedError = mapStrategyErrorToStatus(error);
      res.status(mappedError.status).json({
        error: {
          code: mappedError.code,
          message: mappedError.message,
        },
      });
    }
  });

  router.post("/strategies/:strategyId/stop", (req, res) => {
    const strategyId = req.params.strategyId;
    if (strategyId.trim().length === 0) {
      sendValidationError(res, [{ path: "$.strategyId", message: "must be a non-empty string" }]);
      return;
    }

    try {
      const stopped = dependencies.strategyRuntime.stop(strategyId.trim());
      res.json({ run: stopped });
    } catch (error) {
      const mappedError = mapStrategyErrorToStatus(error);
      res.status(mappedError.status).json({
        error: {
          code: mappedError.code,
          message: mappedError.message,
        },
      });
    }
  });

  router.get("/strategies/:strategyId/status", (req, res) => {
    const strategyId = req.params.strategyId;
    const run = dependencies.strategyRuntime.getStatus(strategyId);

    if (!run) {
      sendBadRequest(res, "STRATEGY_NOT_FOUND", `No strategy run found for ${strategyId}`);
      return;
    }

    res.json({ run });
  });

  router.get("/strategies/status", (_req, res) => {
    res.json({
      runs: dependencies.strategyRuntime.listRuns(),
    });
  });

  router.get("/metrics", (req: Request, res: Response) => {
    const strategyIdRaw = typeof req.query.strategyId === "string" ? req.query.strategyId : undefined;
    const strategyId = strategyIdRaw?.trim() ? strategyIdRaw.trim() : undefined;
    const windowRaw = typeof req.query.window === "string" ? req.query.window : "all";
    if (!METRICS_WINDOWS.includes(windowRaw as MetricsWindow)) {
      sendValidationError(res, [
        {
          path: "$.window",
          message: `must be one of: ${METRICS_WINDOWS.join(", ")}`,
        },
      ]);
      return;
    }
    const window = windowRaw as MetricsWindow;

    const balances = dependencies.engine.getState();
    const fills = dependencies.getRuntime().fills;

    const toResponse = (result: AnalyticsComputationResult) => ({
      metrics: result.metrics,
      warnings: result.warnings,
      summary: result.summary,
    });

    if (!strategyId) {
      const account = computeAccountAnalytics(fills, balances.holdings, balances.equity, window);
      res.json({
        scope: "account",
        window,
        ...toResponse(account),
      });
      return;
    }

    const runCandidates = dependencies
      .getRuntime()
      .strategyRuns
      .filter((candidate) => candidate.strategyId === strategyId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    const run = runCandidates[runCandidates.length - 1];

    if (!run) {
      sendBadRequest(res, "STRATEGY_NOT_FOUND", `No strategy run found for ${strategyId}`);
      return;
    }

    const strategy = computeStrategyAnalytics(fills, balances.holdings, balances.equity, run, window);

    res.json({
      scope: "strategy",
      window,
      ...toResponse(strategy),
      strategyRun: run,
    });
  });

  return router;
};
