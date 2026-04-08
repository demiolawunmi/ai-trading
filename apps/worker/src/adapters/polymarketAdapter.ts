import type { AdapterDependencies } from "./types";
import { createSimulatedVenueAdapter } from "./simulationUtils";

const isPolymarketVenueOpen = (request: { symbol: string }): boolean => {
  const normalized = request.symbol.trim().toUpperCase();
  return !(normalized.startsWith("CLOSED-") || normalized.includes("-CLOSED-"));
};

export const createPolymarketAdapter = (dependencies: AdapterDependencies) => {
  return createSimulatedVenueAdapter({
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
