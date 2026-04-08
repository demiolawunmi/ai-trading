import type { AdapterDependencies } from "./types";
import { createSimulatedVenueAdapter } from "./simulationUtils";

const isJupiterVenueOpen = (): boolean => true;

export const createJupiterAdapter = (dependencies: AdapterDependencies) => {
  return createSimulatedVenueAdapter({
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
