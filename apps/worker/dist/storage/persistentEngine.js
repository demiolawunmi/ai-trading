"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistExecutionResult = exports.createPersistentEngineState = void 0;
const localPersistence_1 = require("./localPersistence");
const clone = (value) => JSON.parse(JSON.stringify(value));
const isFillEvent = (event) => {
    return event.type === "FillPartial" || event.type === "FillComplete";
};
const createPersistentEngineState = (state, nextSequence) => {
    return {
        nextSequence,
        orders: clone(state.orders),
        fills: clone(state.fills),
        strategyRuns: clone(state.strategyRuns),
    };
};
exports.createPersistentEngineState = createPersistentEngineState;
const persistExecutionResult = (persistence, runtime, balances, orderResult, events) => {
    const nextSequence = persistence.appendLedgerEvents(events, runtime.nextSequence);
    const nextState = {
        nextSequence,
        orders: [...runtime.orders, clone(orderResult)],
        fills: [...runtime.fills, ...events.filter(isFillEvent).map((event) => clone(event))],
        strategyRuns: clone(runtime.strategyRuns),
    };
    (0, localPersistence_1.persistRuntimeState)(persistence, {
        balances: clone(balances),
        orders: nextState.orders,
        fills: nextState.fills,
        strategyRuns: nextState.strategyRuns,
    });
    return nextState;
};
exports.persistExecutionResult = persistExecutionResult;
