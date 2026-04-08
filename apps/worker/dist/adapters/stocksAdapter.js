"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStocksAdapter = void 0;
const simulationUtils_1 = require("./simulationUtils");
const isStocksVenueOpen = () => true;
const createStocksAdapter = (dependencies) => {
    return (0, simulationUtils_1.createSimulatedVenueAdapter)({
        dependencies,
        rules: {
            venue: "stocks",
            symbolPattern: /^[A-Z]{1,5}$/,
            symbolPatternDescription: "[A-Z]{1,5}",
            quantityStep: 1,
            minQuantity: 1,
            minNotional: 1,
            tradingHours: "09:30-16:00 America/New_York (simulated as always open)",
            isVenueOpen: isStocksVenueOpen,
        },
    });
};
exports.createStocksAdapter = createStocksAdapter;
