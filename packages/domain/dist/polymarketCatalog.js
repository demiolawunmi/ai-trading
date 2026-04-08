"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayPolymarketMarket = exports.lookupPolymarketTitle = exports.buildPolymarketSymbol = exports.parsePolymarketSymbol = exports.POLYMARKET_CATALOG = void 0;
const SYMBOL_RE = /^PM-([A-Z0-9-]{3,32})-(YES|NO)$/;
exports.POLYMARKET_CATALOG = [
    { slug: "ELECTION", title: "Will Candidate A win the 2024 election?" },
    { slug: "CHAMPIONSHIP", title: "Will Team X win the national championship?" },
    { slug: "FED-RATE-CUT", title: "Will the Fed cut rates before Q3?" },
    { slug: "BTC-100K", title: "Will BTC close above $100k this year?" },
];
const parsePolymarketSymbol = (symbol) => {
    const normalized = symbol.trim().toUpperCase();
    const match = SYMBOL_RE.exec(normalized);
    if (!match)
        return null;
    return { slug: match[1], outcome: match[2] };
};
exports.parsePolymarketSymbol = parsePolymarketSymbol;
const buildPolymarketSymbol = (slug, outcome) => {
    return `PM-${slug.trim().toUpperCase()}-${outcome}`;
};
exports.buildPolymarketSymbol = buildPolymarketSymbol;
const lookupPolymarketTitle = (normalizedSymbol) => {
    const parsed = (0, exports.parsePolymarketSymbol)(normalizedSymbol);
    if (!parsed)
        return undefined;
    return exports.POLYMARKET_CATALOG.find((entry) => entry.slug === parsed.slug)?.title;
};
exports.lookupPolymarketTitle = lookupPolymarketTitle;
const displayPolymarketMarket = (normalizedSymbol) => {
    const parsed = (0, exports.parsePolymarketSymbol)(normalizedSymbol);
    if (!parsed)
        return normalizedSymbol;
    const catalogTitle = (0, exports.lookupPolymarketTitle)(normalizedSymbol);
    if (catalogTitle) {
        return `${catalogTitle} (${parsed.outcome})`;
    }
    const words = parsed.slug
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");
    return `${words} (${parsed.outcome} outcome)`;
};
exports.displayPolymarketMarket = displayPolymarketMarket;
//# sourceMappingURL=polymarketCatalog.js.map