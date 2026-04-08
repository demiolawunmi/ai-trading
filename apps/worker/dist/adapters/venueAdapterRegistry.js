"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVenueAdapterRegistry = void 0;
const cryptoAdapter_1 = require("./cryptoAdapter");
const jupiterAdapter_1 = require("./jupiterAdapter");
const polymarketAdapter_1 = require("./polymarketAdapter");
const simulationUtils_1 = require("./simulationUtils");
const stocksAdapter_1 = require("./stocksAdapter");
const types_1 = require("./types");
const createEngineExecutor = (engine, onExecution) => {
    return async (request, quotePrice) => {
        try {
            const output = engine.executeMarketOrder({
                order: request,
                quotePrice,
            });
            onExecution?.({
                request,
                result: output.result,
                events: output.events,
            });
            return output.result;
        }
        catch (error) {
            return {
                status: "rejected",
                venue: request.venue,
                symbol: request.symbol.trim().toUpperCase(),
                side: request.side,
                reasonCode: types_1.ADAPTER_ERROR_CODES.INVALID_ORDER_REQUEST,
                message: error instanceof Error ? error.message : String(error),
                requestedQuantity: request.quantity,
                requestedNotional: request.notional,
            };
        }
    };
};
const createVenueAdapterRegistry = (engine, onExecution) => {
    const dependencies = (0, simulationUtils_1.createDefaultAdapterDependencies)(createEngineExecutor(engine, onExecution));
    return {
        stocks: (0, stocksAdapter_1.createStocksAdapter)(dependencies),
        crypto: (0, cryptoAdapter_1.createCryptoAdapter)(dependencies),
        jupiter: (0, jupiterAdapter_1.createJupiterAdapter)(dependencies),
        polymarket: (0, polymarketAdapter_1.createPolymarketAdapter)(dependencies),
    };
};
exports.createVenueAdapterRegistry = createVenueAdapterRegistry;
