"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REJECTION_CODES = exports.PaperExecutionEngine = void 0;
const domain_1 = require("@ai-trading/domain");
const INSUFFICIENT_BUYING_POWER = "INSUFFICIENT_BUYING_POWER";
const INSUFFICIENT_HOLDINGS = "INSUFFICIENT_HOLDINGS";
const INVALID_ORDER_REQUEST = "INVALID_ORDER_REQUEST";
const safeFinite = (value, fallback) => {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return value;
};
const normalizeSymbol = (symbol) => {
    return symbol.trim().toUpperCase();
};
const clamp = (value, min, max) => {
    return Math.min(max, Math.max(min, value));
};
const roundToScale = (value, scale) => {
    const factor = 10 ** scale;
    return Math.round(value * factor) / factor;
};
const resolveRequestedQuantity = (order, price) => {
    if (order.quantity !== undefined) {
        return roundToScale(order.quantity, 8);
    }
    if (order.notional === undefined) {
        throw new Error("Expected quantity or notional to be set after validation");
    }
    if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Quote price must be a finite number greater than zero");
    }
    return roundToScale(order.notional / price, 8);
};
const computeAveragePrice = (plans) => {
    const totalQuantity = plans.reduce((sum, fill) => sum + fill.quantity, 0);
    if (totalQuantity <= 0) {
        return 0;
    }
    const totalCost = plans.reduce((sum, fill) => sum + fill.quantity * fill.price, 0);
    return roundToScale(totalCost / totalQuantity, 8);
};
const buildFillPlans = (requestedQuantity, quotePrice, context, maxSlippageBps, partialFillProbability) => {
    if (requestedQuantity <= 0) {
        return [];
    }
    const plans = [];
    const shouldPartialFill = context.nextRandom() < partialFillProbability;
    if (!shouldPartialFill) {
        const slippageFactor = (context.nextRandom() * 2 - 1) * (maxSlippageBps / 10_000);
        const latencyMs = Math.floor(25 + context.nextRandom() * 75);
        plans.push({
            quantity: roundToScale(requestedQuantity, 8),
            price: roundToScale(quotePrice * (1 + slippageFactor), 8),
            latencyMs,
        });
        return plans;
    }
    const firstSliceRatio = clamp(0.35 + context.nextRandom() * 0.4, 0.2, 0.8);
    const firstQuantity = roundToScale(requestedQuantity * firstSliceRatio, 8);
    const secondQuantity = roundToScale(requestedQuantity - firstQuantity, 8);
    if (firstQuantity <= 0 || secondQuantity <= 0) {
        const fallbackSlippage = (context.nextRandom() * 2 - 1) * (maxSlippageBps / 10_000);
        plans.push({
            quantity: roundToScale(requestedQuantity, 8),
            price: roundToScale(quotePrice * (1 + fallbackSlippage), 8),
            latencyMs: Math.floor(25 + context.nextRandom() * 75),
        });
        return plans;
    }
    const slippageA = (context.nextRandom() * 2 - 1) * (maxSlippageBps / 10_000);
    const slippageB = (context.nextRandom() * 2 - 1) * (maxSlippageBps / 10_000);
    plans.push({
        quantity: firstQuantity,
        price: roundToScale(quotePrice * (1 + slippageA), 8),
        latencyMs: Math.floor(25 + context.nextRandom() * 75),
    }, {
        quantity: secondQuantity,
        price: roundToScale(quotePrice * (1 + slippageB), 8),
        latencyMs: Math.floor(25 + context.nextRandom() * 75),
    });
    return plans;
};
const toPosition = (holding) => {
    const marketPrice = safeFinite(holding.marketPrice ?? holding.averageCost, holding.averageCost);
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
};
const buildPortfolioSnapshot = (state) => {
    return {
        baseCurrency: state.baseCurrency,
        cash: roundToScale(state.cash, 8),
        buyingPower: roundToScale(state.buyingPower, 8),
        positions: state.holdings
            .map((holding) => ({ ...holding, symbol: normalizeSymbol(holding.symbol) }))
            .sort((left, right) => {
            if (left.venue !== right.venue) {
                return left.venue.localeCompare(right.venue);
            }
            return left.symbol.localeCompare(right.symbol);
        })
            .map(toPosition),
    };
};
class PaperExecutionEngine {
    context;
    maxSlippageBps;
    partialFillProbability;
    state;
    constructor(options) {
        this.context = options.context;
        this.maxSlippageBps = clamp(safeFinite(options.maxSlippageBps ?? 25, 25), 0, 10_000);
        this.partialFillProbability = clamp(safeFinite(options.partialFillProbability ?? 0.35, 0.35), 0, 1);
        const holdings = (options.holdings ?? []).map((holding) => ({
            venue: holding.venue,
            symbol: normalizeSymbol(holding.symbol),
            quantity: roundToScale(holding.quantity, 8),
            averageCost: roundToScale(holding.averageCost, 8),
            marketPrice: holding.marketPrice !== undefined ? roundToScale(holding.marketPrice, 8) : undefined,
        }));
        this.state = {
            baseCurrency: options.baseCurrency,
            cash: roundToScale(options.cash, 8),
            buyingPower: roundToScale(options.buyingPower ?? options.cash, 8),
            equity: roundToScale(options.cash, 8),
            holdings,
        };
        this.recomputeEquity();
    }
    getState() {
        return {
            baseCurrency: this.state.baseCurrency,
            cash: this.state.cash,
            buyingPower: this.state.buyingPower,
            equity: this.state.equity,
            holdings: this.state.holdings.map((holding) => ({ ...holding })),
        };
    }
    replaceState(nextState) {
        const normalizedHoldings = nextState.holdings.map((holding) => ({
            venue: holding.venue,
            symbol: normalizeSymbol(holding.symbol),
            quantity: roundToScale(holding.quantity, 8),
            averageCost: roundToScale(holding.averageCost, 8),
            marketPrice: holding.marketPrice !== undefined ? roundToScale(holding.marketPrice, 8) : undefined,
        }));
        this.state = {
            baseCurrency: nextState.baseCurrency,
            cash: roundToScale(nextState.cash, 8),
            buyingPower: roundToScale(nextState.buyingPower, 8),
            equity: roundToScale(nextState.equity, 8),
            holdings: normalizedHoldings,
        };
        this.recomputeEquity();
    }
    executeMarketOrder(input) {
        const events = [];
        const correlationId = this.context.nextId("corr");
        const validation = (0, domain_1.validateMarketOrderRequest)(input.order);
        if (!validation.success || !validation.data) {
            const message = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
            const rejected = {
                status: "rejected",
                venue: input.order.venue,
                symbol: normalizeSymbol(input.order.symbol),
                side: input.order.side,
                reasonCode: INVALID_ORDER_REQUEST,
                message,
                requestedQuantity: input.order.quantity,
                requestedNotional: input.order.notional,
            };
            events.push({
                type: "OrderRequested",
                correlationId,
                timestamp: this.context.nowIso(),
                payload: {
                    ...input.order,
                    symbol: normalizeSymbol(input.order.symbol),
                },
            }, {
                type: "OrderRejected",
                correlationId,
                timestamp: this.context.nowIso(),
                payload: rejected,
            });
            return { result: rejected, events };
        }
        const order = {
            ...validation.data,
            symbol: normalizeSymbol(validation.data.symbol),
        };
        events.push({
            type: "OrderRequested",
            correlationId,
            timestamp: this.context.nowIso(),
            payload: order,
        });
        const requestedQuantity = resolveRequestedQuantity(order, input.quotePrice);
        const requestedNotional = order.notional !== undefined ? roundToScale(order.notional, 8) : roundToScale(requestedQuantity * input.quotePrice, 8);
        if (order.side === "buy") {
            const estimatedGrossCost = roundToScale(requestedQuantity * input.quotePrice, 8);
            if (estimatedGrossCost > this.state.buyingPower) {
                const rejected = {
                    status: "rejected",
                    venue: order.venue,
                    symbol: order.symbol,
                    side: order.side,
                    reasonCode: INSUFFICIENT_BUYING_POWER,
                    message: `Required ${estimatedGrossCost.toFixed(8)} exceeds buying power ${this.state.buyingPower.toFixed(8)}`,
                    requestedQuantity,
                    requestedNotional,
                };
                events.push({
                    type: "OrderRejected",
                    correlationId,
                    timestamp: this.context.nowIso(),
                    payload: rejected,
                });
                return { result: rejected, events };
            }
        }
        const existingHolding = this.findHolding(order.venue, order.symbol);
        if (order.side === "sell") {
            const available = existingHolding?.quantity ?? 0;
            if (requestedQuantity > available) {
                const rejected = {
                    status: "rejected",
                    venue: order.venue,
                    symbol: order.symbol,
                    side: order.side,
                    reasonCode: INSUFFICIENT_HOLDINGS,
                    message: `Required ${requestedQuantity.toFixed(8)} exceeds holdings ${available.toFixed(8)}`,
                    requestedQuantity,
                    requestedNotional,
                };
                events.push({
                    type: "OrderRejected",
                    correlationId,
                    timestamp: this.context.nowIso(),
                    payload: rejected,
                });
                return { result: rejected, events };
            }
        }
        const orderId = this.context.nextId("ord");
        const accepted = {
            status: "accepted",
            orderId,
            venue: order.venue,
            symbol: order.symbol,
            side: order.side,
            requestedQuantity,
            requestedNotional,
        };
        events.push({
            type: "OrderAccepted",
            correlationId,
            timestamp: this.context.nowIso(),
            payload: accepted,
        });
        const fillPlans = buildFillPlans(requestedQuantity, input.quotePrice, this.context, this.maxSlippageBps, this.partialFillProbability);
        let filledQuantity = 0;
        let accumulatedNotional = 0;
        for (const plan of fillPlans) {
            this.context.advanceByMs(plan.latencyMs);
            filledQuantity = roundToScale(filledQuantity + plan.quantity, 8);
            accumulatedNotional = roundToScale(accumulatedNotional + plan.quantity * plan.price, 8);
            const remaining = roundToScale(requestedQuantity - filledQuantity, 8);
            const isComplete = remaining <= 0;
            if (!isComplete) {
                const partialPayload = {
                    orderId,
                    venue: order.venue,
                    symbol: order.symbol,
                    side: order.side,
                    quantity: plan.quantity,
                    price: plan.price,
                    remainingQuantity: remaining,
                };
                events.push({
                    type: "FillPartial",
                    correlationId,
                    timestamp: this.context.nowIso(),
                    payload: partialPayload,
                });
                continue;
            }
            const averagePrice = computeAveragePrice(fillPlans);
            const completePayload = {
                orderId,
                venue: order.venue,
                symbol: order.symbol,
                side: order.side,
                quantity: requestedQuantity,
                averagePrice,
            };
            events.push({
                type: "FillComplete",
                correlationId,
                timestamp: this.context.nowIso(),
                payload: completePayload,
            });
        }
        const averageFillPrice = filledQuantity > 0 ? roundToScale(accumulatedNotional / filledQuantity, 8) : roundToScale(input.quotePrice, 8);
        if (order.side === "buy") {
            this.applyBuyFill(order.venue, order.symbol, filledQuantity, averageFillPrice);
            this.state.cash = roundToScale(this.state.cash - accumulatedNotional, 8);
            this.state.buyingPower = roundToScale(this.state.buyingPower - accumulatedNotional, 8);
        }
        else {
            this.applySellFill(order.venue, order.symbol, filledQuantity, averageFillPrice);
            this.state.cash = roundToScale(this.state.cash + accumulatedNotional, 8);
            this.state.buyingPower = roundToScale(this.state.buyingPower + accumulatedNotional, 8);
        }
        this.recomputeEquity();
        events.push({
            type: "PortfolioUpdated",
            correlationId,
            timestamp: this.context.nowIso(),
            payload: buildPortfolioSnapshot(this.state),
        });
        const result = {
            status: "accepted",
            venue: order.venue,
            symbol: order.symbol,
            side: order.side,
            orderId,
            requestedQuantity,
            requestedNotional,
            filledQuantity,
            averageFillPrice,
        };
        return { result, events };
    }
    findHolding(venue, symbol) {
        return this.state.holdings.find((holding) => holding.venue === venue && holding.symbol === symbol);
    }
    applyBuyFill(venue, symbol, quantity, price) {
        const existing = this.findHolding(venue, symbol);
        if (!existing) {
            this.state.holdings.push({
                venue,
                symbol,
                quantity,
                averageCost: price,
                marketPrice: price,
            });
            return;
        }
        const totalQuantity = roundToScale(existing.quantity + quantity, 8);
        const weightedCost = roundToScale(existing.quantity * existing.averageCost + quantity * price, 8);
        existing.quantity = totalQuantity;
        existing.averageCost = totalQuantity > 0 ? roundToScale(weightedCost / totalQuantity, 8) : existing.averageCost;
        existing.marketPrice = price;
    }
    applySellFill(venue, symbol, quantity, price) {
        const existing = this.findHolding(venue, symbol);
        if (!existing) {
            return;
        }
        existing.quantity = roundToScale(existing.quantity - quantity, 8);
        existing.marketPrice = price;
        if (existing.quantity <= 0) {
            this.state.holdings = this.state.holdings.filter((holding) => !(holding.venue === venue && holding.symbol === symbol));
        }
    }
    recomputeEquity() {
        const holdingsValue = this.state.holdings.reduce((sum, holding) => {
            const marketPrice = safeFinite(holding.marketPrice ?? holding.averageCost, holding.averageCost);
            return sum + holding.quantity * marketPrice;
        }, 0);
        this.state.equity = roundToScale(this.state.cash + holdingsValue, 8);
    }
}
exports.PaperExecutionEngine = PaperExecutionEngine;
exports.REJECTION_CODES = {
    INSUFFICIENT_BUYING_POWER,
    INSUFFICIENT_HOLDINGS,
    INVALID_ORDER_REQUEST,
};
