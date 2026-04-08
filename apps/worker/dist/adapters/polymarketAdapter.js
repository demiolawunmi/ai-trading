"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPolymarketAdapter = void 0;
const simulationUtils_1 = require("./simulationUtils");
const isPolymarketVenueOpen = (request) => {
    const normalized = request.symbol.trim().toUpperCase();
    return !(normalized.startsWith("CLOSED-") || normalized.includes("-CLOSED-"));
};
const createPolymarketAdapter = (dependencies) => {
    return (0, simulationUtils_1.createSimulatedVenueAdapter)({
        dependencies,
        rules: {
            venue: "polymarket",
            symbolPattern: /^PM-[A-Z0-9-]{3,32}-(YES|NO)$/,
            symbolPatternDescription: "PM-<MARKET-SLUG>-(YES|NO)",
            quantityStep: 1,
            minQuantity: 1,
            minNotional: 1,
            tradingHours: "Event-driven (simulated by symbol prefix rule)",
            isVenueOpen: isPolymarketVenueOpen,
        },
    });
};
exports.createPolymarketAdapter = createPolymarketAdapter;
