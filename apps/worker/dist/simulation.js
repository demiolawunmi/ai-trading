"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQuote = exports.deterministicTimestamp = exports.deterministicPrice = void 0;
const node_crypto_1 = require("node:crypto");
const domain_1 = require("@ai-trading/domain");
const hashUnit = (input) => {
    const digest = (0, node_crypto_1.createHash)("sha256").update(input).digest("hex");
    return Number.parseInt(digest.slice(0, 8), 16) / 0xffffffff;
};
const basePrice = {
    stocks: 150,
    crypto: 35000,
    jupiter: 120,
    polymarket: 0.55,
};
const spread = {
    stocks: 0.001,
    crypto: 0.0015,
    jupiter: 0.002,
    polymarket: 0.003,
};
const clamp = (value, scale) => {
    const factor = 10 ** scale;
    return Math.round(value * factor) / factor;
};
const deterministicPrice = (request) => {
    const normalized = request.symbol.trim().toUpperCase();
    const key = `${request.venue}:${normalized}:${request.quantity ?? "-"}:${request.notional ?? "-"}`;
    const drift = hashUnit(key);
    const center = basePrice[request.venue];
    const variance = request.venue === "polymarket" ? 0.15 : center * 0.1;
    const price = center + (drift * 2 - 1) * variance;
    const scale = request.venue === "polymarket" ? 4 : 8;
    return clamp(Math.max(0.01, price), scale);
};
exports.deterministicPrice = deterministicPrice;
const deterministicTimestamp = (request) => {
    const key = `${request.venue}:${request.symbol.trim().toUpperCase()}:${request.quantity ?? "-"}:${request.notional ?? "-"}`;
    const base = Date.parse("2026-01-01T00:00:00.000Z");
    const offsetSeconds = Math.floor(hashUnit(key) * 31_536_000);
    return new Date(base + offsetSeconds * 1000).toISOString();
};
exports.deterministicTimestamp = deterministicTimestamp;
const buildQuote = (request) => {
    const last = (0, exports.deterministicPrice)(request);
    const sp = spread[request.venue];
    const scale = request.venue === "polymarket" ? 4 : 8;
    const bid = clamp(last * (1 - sp), scale);
    const ask = clamp(last * (1 + sp), scale);
    const symbolNormalized = request.symbol.trim().toUpperCase();
    return {
        venue: request.venue,
        symbol: symbolNormalized,
        bid,
        ask,
        last,
        timestamp: (0, exports.deterministicTimestamp)(request),
        instrumentName: request.venue === "polymarket" ? (0, domain_1.displayPolymarketMarket)(symbolNormalized) : undefined,
    };
};
exports.buildQuote = buildQuote;
