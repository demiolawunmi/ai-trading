"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSimulatedVenueAdapter = exports.normalizeRejectedOrder = exports.createDefaultAdapterDependencies = exports.createDeterministicPrice = exports.createDeterministicTimestamp = void 0;
const node_crypto_1 = require("node:crypto");
const domain_1 = require("@ai-trading/domain");
const types_1 = require("./types");
const clampToScale = (value, scale) => {
    const factor = 10 ** scale;
    return Math.round(value * factor) / factor;
};
const hashToUnitInterval = (input) => {
    const digest = (0, node_crypto_1.createHash)("sha256").update(input).digest("hex");
    const firstEight = digest.slice(0, 8);
    const parsed = Number.parseInt(firstEight, 16);
    return parsed / 0xffffffff;
};
const makeFailure = (code, message) => ({
    ok: false,
    code,
    message,
});
const success = { ok: true };
const isStepAligned = (value, step) => {
    const quotient = value / step;
    const rounded = Math.round(quotient);
    return Math.abs(quotient - rounded) <= 1e-8;
};
const resolveEffectiveQuantity = (request, price) => {
    if (request.quantity !== undefined) {
        return request.quantity;
    }
    if (request.notional !== undefined) {
        return request.notional / price;
    }
    return 0;
};
const quoteSpreadByVenue = {
    stocks: 0.001,
    crypto: 0.0015,
    jupiter: 0.002,
    polymarket: 0.003,
};
const createDeterministicTimestamp = (request) => {
    const side = "side" in request ? request.side : "quote";
    const key = `${request.venue}:${request.symbol.trim().toUpperCase()}:${side}:${request.quantity ?? "-"}:${request.notional ?? "-"}`;
    const base = Date.parse("2026-01-01T00:00:00.000Z");
    const offsetSeconds = Math.floor(hashToUnitInterval(key) * 31_536_000);
    return new Date(base + offsetSeconds * 1000).toISOString();
};
exports.createDeterministicTimestamp = createDeterministicTimestamp;
const basePriceByVenue = {
    stocks: 150,
    crypto: 35000,
    jupiter: 120,
    polymarket: 0.55,
};
const createDeterministicPrice = (request) => {
    const normalized = request.symbol.trim().toUpperCase();
    const key = `${request.venue}:${normalized}:${request.quantity ?? "-"}:${request.notional ?? "-"}`;
    const drift = hashToUnitInterval(key);
    const center = basePriceByVenue[request.venue];
    const variance = request.venue === "polymarket" ? 0.15 : center * 0.1;
    const price = center + (drift * 2 - 1) * variance;
    return clampToScale(Math.max(0.01, price), request.venue === "polymarket" ? 4 : 8);
};
exports.createDeterministicPrice = createDeterministicPrice;
const createDefaultAdapterDependencies = (executeOrder) => {
    return {
        getDeterministicTimestamp: exports.createDeterministicTimestamp,
        getDeterministicPrice: exports.createDeterministicPrice,
        executeOrder,
    };
};
exports.createDefaultAdapterDependencies = createDefaultAdapterDependencies;
const normalizeRejectedOrder = (request, failure) => {
    return {
        status: "rejected",
        venue: request.venue,
        symbol: request.symbol.trim().toUpperCase(),
        side: request.side,
        reasonCode: failure.code,
        message: failure.message,
        requestedQuantity: request.quantity,
        requestedNotional: request.notional,
    };
};
exports.normalizeRejectedOrder = normalizeRejectedOrder;
const validateCommonRequest = (request, rules, price) => {
    const baseValidation = (0, domain_1.validateMarketOrderRequest)(request);
    if (!baseValidation.success) {
        return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_REQUEST, baseValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    }
    const normalizedSymbol = request.symbol.trim().toUpperCase();
    if (!rules.symbolPattern.test(normalizedSymbol)) {
        return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_SYMBOL, `Symbol ${normalizedSymbol} does not match ${rules.symbolPatternDescription}`);
    }
    if (!rules.isVenueOpen(request)) {
        return makeFailure(types_1.ADAPTER_ERROR_CODES.VENUE_CLOSED, `${request.venue} is closed for simulated trading`);
    }
    const quantity = resolveEffectiveQuantity(request, price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE, "Unable to resolve a positive quantity from quantity/notional");
    }
    if (rules.minQuantity !== undefined && quantity < rules.minQuantity) {
        return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE, `Resolved quantity ${quantity} is below minimum ${rules.minQuantity}`);
    }
    if (!isStepAligned(quantity, rules.quantityStep)) {
        return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE, `Resolved quantity ${quantity} does not align with step ${rules.quantityStep}`);
    }
    if (rules.minNotional !== undefined && request.notional !== undefined && request.notional < rules.minNotional) {
        return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE, `Notional ${request.notional} is below minimum ${rules.minNotional}`);
    }
    return success;
};
const createSimulatedVenueAdapter = ({ rules, dependencies }) => {
    const metadata = {
        venue: rules.venue,
        symbolFormat: rules.symbolPatternDescription,
        quantityStep: rules.quantityStep,
        minQuantity: rules.minQuantity,
        minNotional: rules.minNotional,
        tradingHours: rules.tradingHours,
    };
    const validateQuoteRequest = (request) => {
        const normalizedSymbol = request.symbol.trim().toUpperCase();
        if (!rules.symbolPattern.test(normalizedSymbol)) {
            return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_SYMBOL, `Symbol ${normalizedSymbol} does not match ${rules.symbolPatternDescription}`);
        }
        if (!rules.isVenueOpen(request)) {
            return makeFailure(types_1.ADAPTER_ERROR_CODES.VENUE_CLOSED, `${request.venue} is closed for simulated trading`);
        }
        const quotePrice = dependencies.getDeterministicPrice(request);
        const quantity = resolveEffectiveQuantity(request, quotePrice);
        if (quantity > 0 && !isStepAligned(quantity, rules.quantityStep)) {
            return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE, `Resolved quantity ${quantity} does not align with step ${rules.quantityStep}`);
        }
        if (rules.minQuantity !== undefined && quantity > 0 && quantity < rules.minQuantity) {
            return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE, `Resolved quantity ${quantity} is below minimum ${rules.minQuantity}`);
        }
        if (rules.minNotional !== undefined && request.notional !== undefined && request.notional < rules.minNotional) {
            return makeFailure(types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE, `Notional ${request.notional} is below minimum ${rules.minNotional}`);
        }
        return success;
    };
    const validateMarketOrder = (request) => {
        const quotePrice = dependencies.getDeterministicPrice({
            venue: request.venue,
            symbol: request.symbol,
            quantity: request.quantity,
            notional: request.notional,
        });
        return validateCommonRequest(request, rules, quotePrice);
    };
    const buildQuote = (request) => {
        const last = dependencies.getDeterministicPrice(request);
        const spread = quoteSpreadByVenue[rules.venue];
        const bid = clampToScale(last * (1 - spread), rules.venue === "polymarket" ? 4 : 8);
        const ask = clampToScale(last * (1 + spread), rules.venue === "polymarket" ? 4 : 8);
        const symbolNormalized = request.symbol.trim().toUpperCase();
        return {
            venue: rules.venue,
            symbol: symbolNormalized,
            bid,
            ask,
            last,
            timestamp: dependencies.getDeterministicTimestamp(request),
            instrumentName: rules.venue === "polymarket" ? (0, domain_1.displayPolymarketMarket)(symbolNormalized) : undefined,
        };
    };
    return {
        venue: rules.venue,
        metadata,
        validateQuoteRequest,
        validateMarketOrder,
        buildQuote,
        async getQuote(request) {
            const validation = validateQuoteRequest(request);
            if (!validation.ok) {
                throw new Error(`${validation.code}: ${validation.message}`);
            }
            return buildQuote(request);
        },
        async placeMarketOrder(request) {
            const validation = validateMarketOrder(request);
            if (!validation.ok) {
                return (0, exports.normalizeRejectedOrder)(request, validation);
            }
            const quote = buildQuote({
                venue: request.venue,
                symbol: request.symbol,
                quantity: request.quantity,
                notional: request.notional,
            });
            return dependencies.executeOrder(request, quote.last);
        },
    };
};
exports.createSimulatedVenueAdapter = createSimulatedVenueAdapter;
