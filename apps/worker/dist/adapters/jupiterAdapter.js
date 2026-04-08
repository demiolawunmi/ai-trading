"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJupiterAdapter = void 0;
const simulationUtils_1 = require("./simulationUtils");
const isJupiterVenueOpen = () => true;
const createJupiterAdapter = (dependencies) => {
    return (0, simulationUtils_1.createSimulatedVenueAdapter)({
        dependencies,
        rules: {
            venue: "jupiter",
            symbolPattern: /^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/,
            symbolPatternDescription: "BASE/QUOTE uppercase pair like SOL/USDC",
            quantityStep: 0.000001,
            minQuantity: 0.0001,
            minNotional: 0.1,
            tradingHours: "24/7",
            isVenueOpen: isJupiterVenueOpen,
        },
    });
};
exports.createJupiterAdapter = createJupiterAdapter;
