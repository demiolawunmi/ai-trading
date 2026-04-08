import type { QuoteRequest, StrategyRun, Venue } from "@ai-trading/domain";

import type { DeterministicExecutionContext } from "../engine/determinism";
import type { PersistentEngineState } from "../storage";

const DEFAULT_VENUE: Venue = "stocks";
const DEFAULT_SYMBOL = "AAPL";
const DEFAULT_HEARTBEAT_INTERVAL_MS = 250;

interface StrategyAdapter {
  getQuote(request: QuoteRequest): Promise<unknown>;
}

type StrategyAdapterRegistry = Record<Venue, StrategyAdapter>;

export interface StrategyRegistrationInput {
  strategyId: string;
  venue?: Venue;
  symbol?: string;
  heartbeatIntervalMs?: number;
  allowConcurrentInstances?: boolean;
  failOnHeartbeat?: boolean;
}

interface StrategyRuntimeConfig {
  strategyId: string;
  venue: Venue;
  symbol: string;
  heartbeatIntervalMs: number;
  allowConcurrentInstances: boolean;
  failOnHeartbeat: boolean;
}

export class StrategyRuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface StrategyRuntimeDependencies {
  executionContext: DeterministicExecutionContext;
  adapters: StrategyAdapterRegistry;
  getRuntime(): PersistentEngineState;
  persistRuntime(nextRuntime: PersistentEngineState): void;
}

const normalizeStrategyId = (strategyId: string): string => strategyId.trim();

const toRuntimeConfig = (input: StrategyRegistrationInput): StrategyRuntimeConfig => {
  const symbol = (input.symbol ?? DEFAULT_SYMBOL).trim().toUpperCase();

  return {
    strategyId: normalizeStrategyId(input.strategyId),
    venue: input.venue ?? DEFAULT_VENUE,
    symbol: symbol.length > 0 ? symbol : DEFAULT_SYMBOL,
    heartbeatIntervalMs:
      input.heartbeatIntervalMs !== undefined ? input.heartbeatIntervalMs : DEFAULT_HEARTBEAT_INTERVAL_MS,
    allowConcurrentInstances: input.allowConcurrentInstances ?? false,
    failOnHeartbeat: input.failOnHeartbeat ?? false,
  };
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class StrategyRuntimeManager {
  private readonly executionContext: DeterministicExecutionContext;

  private readonly adapters: StrategyAdapterRegistry;

  private readonly getRuntime: () => PersistentEngineState;

  private readonly persistRuntime: (nextRuntime: PersistentEngineState) => void;

  private readonly configs = new Map<string, StrategyRuntimeConfig>();

  private readonly activeRunIdsByStrategy = new Map<string, Set<string>>();

  private readonly timersByRunId = new Map<string, NodeJS.Timeout>();

  private readonly inFlightRunIds = new Set<string>();

  constructor(dependencies: StrategyRuntimeDependencies) {
    this.executionContext = dependencies.executionContext;
    this.adapters = dependencies.adapters;
    this.getRuntime = dependencies.getRuntime;
    this.persistRuntime = dependencies.persistRuntime;
    this.restoreFromPersistence();
  }

  register(input: StrategyRegistrationInput): StrategyRun {
    const config = toRuntimeConfig(input);
    this.configs.set(config.strategyId, config);

    const latest = this.getLatestRun(config.strategyId);
    if (latest && (latest.status === "registered" || latest.status === "running")) {
      return latest;
    }

    const now = this.executionContext.nowIso();
    const created: StrategyRun = {
      id: this.executionContext.nextId("run"),
      strategyId: config.strategyId,
      status: "registered",
      createdAt: now,
      updatedAt: now,
    };

    this.persistNextRuntime((runtime) => ({
      ...runtime,
      strategyRuns: [...runtime.strategyRuns, created],
    }));

    return created;
  }

  start(strategyId: string): StrategyRun {
    const normalizedStrategyId = normalizeStrategyId(strategyId);
    if (normalizedStrategyId.length === 0) {
      throw new StrategyRuntimeError("VALIDATION_ERROR", "strategyId must be a non-empty string");
    }

    if (!this.configs.has(normalizedStrategyId)) {
      this.configs.set(
        normalizedStrategyId,
        toRuntimeConfig({
          strategyId: normalizedStrategyId,
        }),
      );
    }

    const config = this.configs.get(normalizedStrategyId);
    if (!config) {
      throw new StrategyRuntimeError("STRATEGY_NOT_FOUND", `No strategy configuration found for ${normalizedStrategyId}`);
    }

    const activeRunIds = this.getActiveRunIds(normalizedStrategyId);
    if (!config.allowConcurrentInstances && activeRunIds.size > 0) {
      throw new StrategyRuntimeError(
        "STRATEGY_ALREADY_RUNNING",
        `strategy ${normalizedStrategyId} already has an active instance`,
      );
    }

    const now = this.executionContext.nowIso();
    const run: StrategyRun = {
      id: this.executionContext.nextId("run"),
      strategyId: normalizedStrategyId,
      status: "running",
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      stoppedAt: undefined,
      failureReason: undefined,
    };

    this.persistNextRuntime((runtime) => ({
      ...runtime,
      strategyRuns: [...runtime.strategyRuns, run],
    }));

    this.trackActiveRun(normalizedStrategyId, run.id);
    this.startHeartbeatLoop(run, config);

    return run;
  }

  stop(strategyId: string): StrategyRun {
    const normalizedStrategyId = normalizeStrategyId(strategyId);
    const activeRun = this.getMostRecentActiveRun(normalizedStrategyId);

    if (!activeRun) {
      const latest = this.getLatestRun(normalizedStrategyId);
      if (!latest) {
        throw new StrategyRuntimeError("STRATEGY_NOT_FOUND", `No strategy run found for ${normalizedStrategyId}`);
      }

      return latest;
    }

    return this.updateRun(activeRun.id, (existing) => {
      const now = this.executionContext.nowIso();
      return {
        ...existing,
        status: "stopped",
        updatedAt: now,
        stoppedAt: now,
        failureReason: undefined,
      };
    });
  }

  getStatus(strategyId: string): StrategyRun | undefined {
    return this.getLatestRun(normalizeStrategyId(strategyId));
  }

  listRuns(): StrategyRun[] {
    return clone(this.getRuntime().strategyRuns);
  }

  shutdown(): void {
    for (const timer of this.timersByRunId.values()) {
      clearInterval(timer);
    }

    this.timersByRunId.clear();
    this.activeRunIdsByStrategy.clear();
    this.inFlightRunIds.clear();
  }

  private restoreFromPersistence(): void {
    const runtime = this.getRuntime();

    for (const run of runtime.strategyRuns) {
      if (!this.configs.has(run.strategyId)) {
        this.configs.set(
          run.strategyId,
          toRuntimeConfig({
            strategyId: run.strategyId,
          }),
        );
      }
    }

    const runningRunIds = runtime.strategyRuns.filter((run) => run.status === "running").map((run) => run.id);
    if (runningRunIds.length === 0) {
      return;
    }

    this.persistNextRuntime((currentRuntime) => ({
      ...currentRuntime,
      strategyRuns: currentRuntime.strategyRuns.map((run) => {
        if (run.status !== "running") {
          return run;
        }

        const now = this.executionContext.nowIso();
        return {
          ...run,
          status: "stopped",
          updatedAt: now,
          stoppedAt: now,
        };
      }),
    }));
  }

  private getActiveRunIds(strategyId: string): Set<string> {
    let runIds = this.activeRunIdsByStrategy.get(strategyId);
    if (!runIds) {
      runIds = new Set<string>();
      this.activeRunIdsByStrategy.set(strategyId, runIds);
    }
    return runIds;
  }

  private trackActiveRun(strategyId: string, runId: string): void {
    this.getActiveRunIds(strategyId).add(runId);
  }

  private clearActiveRun(strategyId: string, runId: string): void {
    const activeRunIds = this.activeRunIdsByStrategy.get(strategyId);
    if (!activeRunIds) {
      return;
    }

    activeRunIds.delete(runId);
    if (activeRunIds.size === 0) {
      this.activeRunIdsByStrategy.delete(strategyId);
    }
  }

  private getLatestRun(strategyId: string): StrategyRun | undefined {
    const runtime = this.getRuntime();
    const runs = runtime.strategyRuns.filter((run) => run.strategyId === strategyId);
    if (runs.length === 0) {
      return undefined;
    }

    return clone(runs[runs.length - 1]);
  }

  private getMostRecentActiveRun(strategyId: string): StrategyRun | undefined {
    const activeRunIds = this.activeRunIdsByStrategy.get(strategyId);
    if (!activeRunIds || activeRunIds.size === 0) {
      return undefined;
    }

    const runtime = this.getRuntime();
    const runs = runtime.strategyRuns
      .filter((run) => run.strategyId === strategyId && activeRunIds.has(run.id))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return runs[runs.length - 1];
  }

  private startHeartbeatLoop(run: StrategyRun, config: StrategyRuntimeConfig): void {
    const timer = setInterval(() => {
      void this.executeHeartbeat(run.id, config);
    }, config.heartbeatIntervalMs);

    this.timersByRunId.set(run.id, timer);
  }

  private async executeHeartbeat(runId: string, config: StrategyRuntimeConfig): Promise<void> {
    if (this.inFlightRunIds.has(runId)) {
      return;
    }

    this.inFlightRunIds.add(runId);

    try {
      const run = this.findRunById(runId);
      if (!run || run.status !== "running") {
        this.stopTimer(runId);
        return;
      }

      if (config.failOnHeartbeat) {
        throw new Error("Configured strategy failure for runtime isolation test");
      }

      await this.adapters[config.venue].getQuote({
        venue: config.venue,
        symbol: config.symbol,
        quantity: 1,
      });

      this.updateRun(runId, (existing) => ({
        ...existing,
        updatedAt: this.executionContext.nowIso(),
      }));
    } catch (error) {
      this.updateRun(runId, (existing) => {
        const now = this.executionContext.nowIso();
        return {
          ...existing,
          status: "failed",
          updatedAt: now,
          stoppedAt: now,
          failureReason: error instanceof Error ? error.message : String(error),
        };
      });
    } finally {
      this.inFlightRunIds.delete(runId);
    }
  }

  private findRunById(runId: string): StrategyRun | undefined {
    return this.getRuntime().strategyRuns.find((run) => run.id === runId);
  }

  private stopTimer(runId: string): void {
    const timer = this.timersByRunId.get(runId);
    if (timer) {
      clearInterval(timer);
      this.timersByRunId.delete(runId);
    }
  }

  private updateRun(runId: string, updater: (run: StrategyRun) => StrategyRun): StrategyRun {
    let updatedRun: StrategyRun | undefined;

    this.persistNextRuntime((runtime) => {
      const nextRuns = runtime.strategyRuns.map((run) => {
        if (run.id !== runId) {
          return run;
        }

        updatedRun = updater(run);
        return updatedRun;
      });

      if (!updatedRun) {
        throw new StrategyRuntimeError("STRATEGY_NOT_FOUND", `No strategy run found for runId ${runId}`);
      }

      return {
        ...runtime,
        strategyRuns: nextRuns,
      };
    });

    const run = updatedRun as StrategyRun;
    if (run.status !== "running") {
      this.stopTimer(run.id);
      this.clearActiveRun(run.strategyId, run.id);
    }

    return clone(run);
  }

  private persistNextRuntime(
    updater: (runtime: PersistentEngineState) => PersistentEngineState,
  ): void {
    const current = this.getRuntime();
    const next = updater({
      ...current,
      orders: clone(current.orders),
      fills: clone(current.fills),
      strategyRuns: clone(current.strategyRuns),
    });
    this.persistRuntime(next);
  }
}
