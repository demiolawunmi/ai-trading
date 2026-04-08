import type { AdapterDependencies } from "./types";
import { createSimulatedVenueAdapter } from "./simulationUtils";

const isStocksVenueOpen = (): boolean => true;

export const createStocksAdapter = (dependencies: AdapterDependencies) => {
  return createSimulatedVenueAdapter({
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
