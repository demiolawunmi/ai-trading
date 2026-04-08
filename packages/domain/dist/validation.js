"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePortfolioUpdate = exports.validateMarketOrderRequest = exports.validateQuoteRequest = exports.validateSymbolForVenue = void 0;
const contracts_1 = require("./contracts");
const isVenue = (v) => typeof v === "string" && contracts_1.VENUES.includes(v);
const isOrderSide = (s) => typeof s === "string" && contracts_1.ORDER_SIDES.includes(s);
const fail = (path, message) => ({
    ok: false,
    issues: [{ path, message }],
});
const STOCK = /^[A-Z]{1,5}$/;
const CRYPTO = /^[A-Z]{2,10}(USD|USDT|USDC)$/;
const JUPITER = /^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/;
const POLY = /^PM-[A-Z0-9-]{3,32}-(YES|NO)$/;
const validateSymbolForVenue = (venue, symbol) => {
    const s = symbol.trim().toUpperCase();
    if (!s)
        return fail("symbol", "Symbol is required.");
    if (venue === "stocks" && !STOCK.test(s))
        return fail("symbol", "Invalid stock symbol.");
    if (venue === "crypto" && !CRYPTO.test(s))
        return fail("symbol", "Invalid crypto pair.");
    if (venue === "jupiter" && !JUPITER.test(s))
        return fail("symbol", "Invalid Jupiter pair.");
    if (venue === "polymarket" && !POLY.test(s))
        return fail("symbol", "Invalid Polymarket symbol.");
    return { ok: true };
};
exports.validateSymbolForVenue = validateSymbolForVenue;
const validateQuoteRequest = (body) => {
    if (!body || typeof body !== "object")
        return fail("$", "Body must be a JSON object.");
    const o = body;
    if (!isVenue(o.venue))
        return fail("venue", "Invalid venue.");
    if (typeof o.symbol !== "string")
        return fail("symbol", "Symbol must be a string.");
    const sym = (0, exports.validateSymbolForVenue)(o.venue, o.symbol);
    if (!sym.ok)
        return sym;
    if (o.quantity !== undefined) {
        if (typeof o.quantity !== "number" || !Number.isFinite(o.quantity) || o.quantity <= 0) {
            return fail("quantity", "Quantity must be a positive number.");
        }
    }
    if (o.notional !== undefined) {
        if (typeof o.notional !== "number" || !Number.isFinite(o.notional) || o.notional <= 0) {
            return fail("notional", "Notional must be a positive number.");
        }
    }
    return { ok: true };
};
exports.validateQuoteRequest = validateQuoteRequest;
const validateMarketOrderRequest = (body) => {
    const base = (0, exports.validateQuoteRequest)(body);
    if (!base.ok)
        return base;
    const o = body;
    if (!isOrderSide(o.side))
        return fail("side", "Side must be buy or sell.");
    return { ok: true };
};
exports.validateMarketOrderRequest = validateMarketOrderRequest;
const validatePortfolioUpdate = (body) => {
    if (!body || typeof body !== "object")
        return fail("$", "Body must be a JSON object.");
    const o = body;
    if (typeof o.baseCurrency !== "string" || !o.baseCurrency.trim()) {
        return fail("baseCurrency", "baseCurrency is required.");
    }
    if (typeof o.cash !== "number" || !Number.isFinite(o.cash))
        return fail("cash", "Invalid cash.");
    if (typeof o.buyingPower !== "number" || !Number.isFinite(o.buyingPower)) {
        return fail("buyingPower", "Invalid buyingPower.");
    }
    if (!Array.isArray(o.holdings))
        return fail("holdings", "holdings must be an array.");
    return { ok: true };
};
exports.validatePortfolioUpdate = validatePortfolioUpdate;
//# sourceMappingURL=validation.js.map