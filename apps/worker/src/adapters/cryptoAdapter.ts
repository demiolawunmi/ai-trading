import type { AdapterDependencies } from "./types";
import { createSimulatedVenueAdapter } from "./simulationUtils";

const isCryptoVenueOpen = (): boolean => true;

export const createCryptoAdapter = (dependencies: AdapterDependencies) => {
  return createSimulatedVenueAdapter({
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
