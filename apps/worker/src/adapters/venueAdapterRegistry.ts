import type { DomainEvent, MarketOrderRequest, OrderResult, Venue, VenueAdapter } from "@ai-trading/domain";

import type { PaperExecutionEngine } from "../engine/paperExecutionEngine";
import { createCryptoAdapter } from "./cryptoAdapter";
import { createJupiterAdapter } from "./jupiterAdapter";
import { createPolymarketAdapter } from "./polymarketAdapter";
import { createDefaultAdapterDependencies } from "./simulationUtils";
import { createStocksAdapter } from "./stocksAdapter";
import { ADAPTER_ERROR_CODES } from "./types";

export interface ExecutionCallbackPayload {
  request: MarketOrderRequest;
  result: OrderResult;
  events: DomainEvent[];
}

const createEngineExecutor = (
  engine: PaperExecutionEngine,
  onExecution?: (payload: ExecutionCallbackPayload) => void,
) => {
  return async (request: MarketOrderRequest, quotePrice: number) => {
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
    } catch (error) {
      return {
        status: "rejected" as const,
        venue: request.venue,
        symbol: request.symbol.trim().toUpperCase(),
        side: request.side,
        reasonCode: ADAPTER_ERROR_CODES.INVALID_ORDER_REQUEST,
        message: error instanceof Error ? error.message : String(error),
        requestedQuantity: request.quantity,
        requestedNotional: request.notional,
      };
    }
  };
};

export const createVenueAdapterRegistry = (
  engine: PaperExecutionEngine,
  onExecution?: (payload: ExecutionCallbackPayload) => void,
): Record<Venue, VenueAdapter> => {
  const dependencies = createDefaultAdapterDependencies(createEngineExecutor(engine, onExecution));

  return {
    stocks: createStocksAdapter(dependencies),
    crypto: createCryptoAdapter(dependencies),
    jupiter: createJupiterAdapter(dependencies),
    polymarket: createPolymarketAdapter(dependencies),
  };
};
