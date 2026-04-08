import type { BalanceState, DomainEvent, FillComplete, FillPartial, OrderResult, StrategyRun } from "@ai-trading/domain";

import type { LocalPersistence } from "./localPersistence";
import { persistRuntimeState } from "./localPersistence";

export interface PersistentEngineState {
  nextSequence: number;
  orders: OrderResult[];
  fills: Array<FillPartial | FillComplete>;
  strategyRuns: StrategyRun[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isFillEvent = (event: DomainEvent): event is FillPartial | FillComplete => {
  return event.type === "FillPartial" || event.type === "FillComplete";
};

export const createPersistentEngineState = (
  state: Omit<PersistentEngineState, "nextSequence">,
  nextSequence: number,
): PersistentEngineState => {
  return {
    nextSequence,
    orders: clone(state.orders),
    fills: clone(state.fills),
    strategyRuns: clone(state.strategyRuns),
  };
};

export const persistExecutionResult = (
  persistence: LocalPersistence,
  runtime: PersistentEngineState,
  balances: BalanceState,
  orderResult: OrderResult,
  events: DomainEvent[],
): PersistentEngineState => {
  const nextSequence = persistence.appendLedgerEvents(events, runtime.nextSequence);
  const nextState: PersistentEngineState = {
    nextSequence,
    orders: [...runtime.orders, clone(orderResult)],
    fills: [...runtime.fills, ...events.filter(isFillEvent).map((event) => clone(event))],
    strategyRuns: clone(runtime.strategyRuns),
  };

  persistRuntimeState(persistence, {
    balances: clone(balances),
    orders: nextState.orders,
    fills: nextState.fills,
    strategyRuns: nextState.strategyRuns,
  });

  return nextState;
};
