"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCryptoAdapter = void 0;
const simulationUtils_1 = require("./simulationUtils");
const isCryptoVenueOpen = () => true;
const createCryptoAdapter = (dependencies) => {
    return (0, simulationUtils_1.createSimulatedVenueAdapter)({
        dependencies,
        rules: {
            venue: "crypto",
            symbolPattern: /^[A-Z]{2,10}(USD|USDT|USDC)$/,
            symbolPatternDescription: "BASEQUOTE uppercase pair like BTCUSD/ETHUSDT",
            quantityStep: 0.000001,
            minQuantity: 0.0001,
            minNotional: 1,
            tradingHours: "24/7",
            isVenueOpen: isCryptoVenueOpen,
        },
    });
};
exports.createCryptoAdapter = createCryptoAdapter;
