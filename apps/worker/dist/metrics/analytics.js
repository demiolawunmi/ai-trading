"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeStrategyAnalytics = exports.computeAccountAnalytics = exports.filterFillsForStrategyRun = exports.METRICS_WINDOWS = void 0;
exports.METRICS_WINDOWS = ["all", "1h", "24h", "7d"];
const roundToScale = (value, scale) => {
    const factor = 10 ** scale;
    return Math.round(value * factor) / factor;
};
const toPositionKey = (venue, symbol) => `${venue}:${symbol.trim().toUpperCase()}`;
const sortFills = (fills) => {
    return fills
        .filter((fill) => fill.type === "FillComplete")
        .slice()
        .sort((left, right) => {
        if (left.timestamp !== right.timestamp) {
            return left.timestamp.localeCompare(right.timestamp);
        }
        return left.payload.orderId.localeCompare(right.payload.orderId);
    });
};
const WINDOW_DURATIONS_MS = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
};
const applyMetricsWindow = (fills, window) => {
    if (window === "all" || fills.length === 0) {
        return fills;
    }
    const duration = WINDOW_DURATIONS_MS[window];
    const anchorTimestamp = Date.parse(fills[fills.length - 1].timestamp);
    if (!Number.isFinite(anchorTimestamp)) {
        return fills;
    }
    const windowStart = anchorTimestamp - duration;
    return fills.filter((fill) => Date.parse(fill.timestamp) >= windowStart);
};
const buildHoldingsFromFills = (fills, marksByKey) => {
    const positions = new Map();
    for (const fill of fills) {
        const key = toPositionKey(fill.payload.venue, fill.payload.symbol);
        const existing = positions.get(key) ?? { quantity: 0, averageCost: 0 };
        if (fill.payload.side === "buy") {
            const totalQuantity = roundToScale(existing.quantity + fill.payload.quantity, 8);
            const weightedCost = roundToScale(existing.quantity * existing.averageCost + fill.payload.quantity * fill.payload.averagePrice, 8);
            positions.set(key, {
                quantity: totalQuantity,
                averageCost: totalQuantity > 0 ? roundToScale(weightedCost / totalQuantity, 8) : 0,
            });
            continue;
        }
        const remainingQuantity = roundToScale(Math.max(0, existing.quantity - fill.payload.quantity), 8);
        positions.set(key, {
            quantity: remainingQuantity,
            averageCost: existing.averageCost,
        });
    }
    return Array.from(positions.entries())
        .filter(([, position]) => position.quantity > 0)
        .map(([key, position]) => {
        const [venue, symbol] = key.split(":");
        return {
            venue: venue,
            symbol,
            quantity: roundToScale(position.quantity, 8),
            averageCost: roundToScale(position.averageCost, 8),
            marketPrice: marksByKey.get(key),
        };
    })
        .sort((left, right) => {
        if (left.venue !== right.venue) {
            return left.venue.localeCompare(right.venue);
        }
        return left.symbol.localeCompare(right.symbol);
    });
};
const computeRealizedStats = (fills) => {
    const positions = new Map();
    const closedTrades = [];
    let realizedPnl = 0;
    let wins = 0;
    for (const fill of fills) {
        const key = toPositionKey(fill.payload.venue, fill.payload.symbol);
        const existing = positions.get(key) ?? { quantity: 0, averageCost: 0 };
        if (fill.payload.side === "buy") {
            const totalQuantity = roundToScale(existing.quantity + fill.payload.quantity, 8);
            const weightedCost = roundToScale(existing.quantity * existing.averageCost + fill.payload.quantity * fill.payload.averagePrice, 8);
            positions.set(key, {
                quantity: totalQuantity,
                averageCost: totalQuantity > 0 ? roundToScale(weightedCost / totalQuantity, 8) : 0,
            });
            continue;
        }
        const closableQuantity = roundToScale(Math.min(existing.quantity, fill.payload.quantity), 8);
        if (closableQuantity <= 0) {
            continue;
        }
        const tradeBasis = roundToScale(existing.averageCost * closableQuantity, 8);
        const tradePnl = roundToScale((fill.payload.averagePrice - existing.averageCost) * closableQuantity, 8);
        realizedPnl = roundToScale(realizedPnl + tradePnl, 8);
        closedTrades.push({
            pnl: tradePnl,
            basis: tradeBasis,
        });
        if (tradePnl > 0) {
            wins += 1;
        }
        const remainingQuantity = roundToScale(existing.quantity - closableQuantity, 8);
        positions.set(key, {
            quantity: remainingQuantity,
            averageCost: existing.averageCost,
        });
    }
    return {
        realizedPnl,
        closedTrades,
        wins,
    };
};
const computeMaxDrawdown = (closedTrades) => {
    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const trade of closedTrades) {
        const pnl = trade.pnl;
        cumulative = roundToScale(cumulative + pnl, 8);
        peak = Math.max(peak, cumulative);
        maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    }
    return roundToScale(maxDrawdown, 8);
};
const computeSharpeLikeRatio = (closedTrades, defaultDenominator, usePerTradeBasis) => {
    if (closedTrades.length < 2) {
        return 0;
    }
    const denominator = Math.max(Math.abs(defaultDenominator), 1);
    const returns = closedTrades.map((trade) => {
        const tradeDenominator = usePerTradeBasis ? Math.max(Math.abs(trade.basis), 1) : denominator;
        return trade.pnl / tradeDenominator;
    });
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => {
        const delta = value - mean;
        return sum + delta * delta;
    }, 0) / returns.length;
    if (variance <= 0) {
        return 0;
    }
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) {
        return 0;
    }
    return roundToScale((mean / stdDev) * Math.sqrt(returns.length), 8);
};
const computeStrategyCapitalBaseline = (fills) => {
    const positions = new Map();
    let maxGrossCost = 0;
    for (const fill of fills) {
        const key = toPositionKey(fill.payload.venue, fill.payload.symbol);
        const existing = positions.get(key) ?? { quantity: 0, averageCost: 0 };
        if (fill.payload.side === "buy") {
            const totalQuantity = roundToScale(existing.quantity + fill.payload.quantity, 8);
            const weightedCost = roundToScale(existing.quantity * existing.averageCost + fill.payload.quantity * fill.payload.averagePrice, 8);
            positions.set(key, {
                quantity: totalQuantity,
                averageCost: totalQuantity > 0 ? roundToScale(weightedCost / totalQuantity, 8) : 0,
            });
        }
        else {
            const remainingQuantity = roundToScale(Math.max(0, existing.quantity - fill.payload.quantity), 8);
            positions.set(key, {
                quantity: remainingQuantity,
                averageCost: existing.averageCost,
            });
        }
        let grossCost = 0;
        for (const position of positions.values()) {
            if (position.quantity <= 0) {
                continue;
            }
            grossCost = roundToScale(grossCost + position.quantity * position.averageCost, 8);
        }
        maxGrossCost = Math.max(maxGrossCost, grossCost);
    }
    return roundToScale(maxGrossCost, 8);
};
const computeUnrealizedAndExposure = (holdings) => {
    let unrealizedPnl = 0;
    let grossExposure = 0;
    const missingMarkSymbols = [];
    for (const holding of holdings) {
        const hasMark = typeof holding.marketPrice === "number" && Number.isFinite(holding.marketPrice);
        if (!hasMark) {
            missingMarkSymbols.push(`${holding.venue}:${holding.symbol}`);
            continue;
        }
        const marketPrice = holding.marketPrice;
        unrealizedPnl = roundToScale(unrealizedPnl + (marketPrice - holding.averageCost) * holding.quantity, 8);
        grossExposure = roundToScale(grossExposure + marketPrice * holding.quantity, 8);
    }
    const warnings = [];
    if (missingMarkSymbols.length > 0) {
        warnings.push({
            code: "MISSING_MARK_PRICE",
            message: "One or more symbols are missing mark price; unrealized PnL and exposure exclude those symbols.",
            symbols: missingMarkSymbols.sort(),
        });
    }
    return {
        unrealizedPnl,
        grossExposure,
        warnings,
    };
};
const timestampInRange = (value, start, end) => {
    return value >= start && value <= end;
};
const filterFillsForStrategyRun = (fills, run) => {
    const start = run.startedAt ?? run.createdAt;
    const end = run.stoppedAt ?? run.updatedAt;
    return sortFills(fills).filter((fill) => timestampInRange(fill.timestamp, start, end));
};
exports.filterFillsForStrategyRun = filterFillsForStrategyRun;
const computeAccountAnalytics = (fills, holdings, totalEquity, window = "all", options) => {
    const sortedFills = sortFills(fills);
    const windowedFills = applyMetricsWindow(sortedFills, window);
    const realizedStats = computeRealizedStats(windowedFills);
    const unrealizedStats = computeUnrealizedAndExposure(holdings);
    const roundedEquity = roundToScale(totalEquity, 8);
    const exposureBaseline = roundToScale(options?.exposureBaseline ?? roundedEquity, 8);
    return {
        metrics: {
            realizedPnl: realizedStats.realizedPnl,
            unrealizedPnl: unrealizedStats.unrealizedPnl,
            totalEquity: roundedEquity,
            maxDrawdown: computeMaxDrawdown(realizedStats.closedTrades),
            winRate: realizedStats.closedTrades.length > 0
                ? roundToScale(realizedStats.wins / realizedStats.closedTrades.length, 8)
                : 0,
            exposure: exposureBaseline > 0 ? roundToScale(unrealizedStats.grossExposure / exposureBaseline, 8) : 0,
            sharpeLikeRatio: computeSharpeLikeRatio(realizedStats.closedTrades, roundedEquity, options?.usePerTradeSharpeBasis ?? false),
        },
        warnings: unrealizedStats.warnings,
        summary: {
            hasActivity: sortedFills.length > 0 || holdings.length > 0,
            closedTrades: realizedStats.closedTrades.length,
            fillCount: windowedFills.length,
        },
    };
};
exports.computeAccountAnalytics = computeAccountAnalytics;
const computeStrategyAnalytics = (fills, accountHoldings, totalEquity, run, window = "all") => {
    const strategyFills = (0, exports.filterFillsForStrategyRun)(fills, run);
    const marksByKey = new Map();
    for (const holding of accountHoldings) {
        marksByKey.set(toPositionKey(holding.venue, holding.symbol), holding.marketPrice);
    }
    const strategyHoldings = buildHoldingsFromFills(strategyFills, marksByKey);
    const strategyCapitalBaseline = computeStrategyCapitalBaseline(strategyFills);
    return (0, exports.computeAccountAnalytics)(strategyFills, strategyHoldings, totalEquity, window, {
        exposureBaseline: strategyCapitalBaseline,
        usePerTradeSharpeBasis: true,
    });
};
exports.computeStrategyAnalytics = computeStrategyAnalytics;
