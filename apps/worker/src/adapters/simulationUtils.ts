import { createHash } from "node:crypto";

import type {
  MarketOrderRequest,
  Quote,
  QuoteRequest,
  Venue,
} from "@ai-trading/domain";

import { displayPolymarketMarket, validateMarketOrderRequest } from "@ai-trading/domain";
import {
  ADAPTER_ERROR_CODES,
  type AdapterDependencies,
  type AdapterErrorCode,
  type AdapterValidationFailure,
  type AdapterValidationResult,
  type SimulatedVenueAdapter,
  type ValidationResult,
  type VenueRuleMetadata,
} from "./types";

interface VenueRuleConfig {
  venue: Venue;
  symbolPattern: RegExp;
  symbolPatternDescription: string;
  quantityStep: number;
  minQuantity?: number;
  minNotional?: number;
  tradingHours: string;
  isVenueOpen: (request: QuoteRequest | MarketOrderRequest) => boolean;
}

const clampToScale = (value: number, scale: number): number => {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
};

const hashToUnitInterval = (input: string): number => {
  const digest = createHash("sha256").update(input).digest("hex");
  const firstEight = digest.slice(0, 8);
  const parsed = Number.parseInt(firstEight, 16);
  return parsed / 0xffffffff;
};

const makeFailure = (code: AdapterErrorCode, message: string): AdapterValidationFailure => ({
  ok: false,
  code,
  message,
});

const success: AdapterValidationResult = { ok: true };

const isStepAligned = (value: number, step: number): boolean => {
  const quotient = value / step;
  const rounded = Math.round(quotient);
  return Math.abs(quotient - rounded) <= 1e-8;
};

const resolveEffectiveQuantity = (request: QuoteRequest | MarketOrderRequest, price: number): number => {
  if (request.quantity !== undefined) {
    return request.quantity;
  }

  if (request.notional !== undefined) {
    return request.notional / price;
  }

  return 0;
};

const quoteSpreadByVenue: Record<Venue, number> = {
  stocks: 0.001,
  crypto: 0.0015,
  jupiter: 0.002,
  polymarket: 0.003,
};

export const createDeterministicTimestamp = (request: QuoteRequest | MarketOrderRequest): string => {
  const side = "side" in request ? request.side : "quote";
  const key = `${request.venue}:${request.symbol.trim().toUpperCase()}:${side}:${request.quantity ?? "-"}:${request.notional ?? "-"}`;
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  const offsetSeconds = Math.floor(hashToUnitInterval(key) * 31_536_000);
  return new Date(base + offsetSeconds * 1000).toISOString();
};

const basePriceByVenue: Record<Venue, number> = {
  stocks: 150,
  crypto: 35000,
  jupiter: 120,
  polymarket: 0.55,
};

export const createDeterministicPrice = (request: QuoteRequest): number => {
  const normalized = request.symbol.trim().toUpperCase();
  const key = `${request.venue}:${normalized}:${request.quantity ?? "-"}:${request.notional ?? "-"}`;
  const drift = hashToUnitInterval(key);
  const center = basePriceByVenue[request.venue];
  const variance = request.venue === "polymarket" ? 0.15 : center * 0.1;
  const price = center + (drift * 2 - 1) * variance;
  return clampToScale(Math.max(0.01, price), request.venue === "polymarket" ? 4 : 8);
};

export const createDefaultAdapterDependencies = (
  executeOrder: AdapterDependencies["executeOrder"],
): AdapterDependencies => {
  return {
    getDeterministicTimestamp: createDeterministicTimestamp,
    getDeterministicPrice: createDeterministicPrice,
    executeOrder,
  };
};

export const normalizeRejectedOrder = (
  request: MarketOrderRequest,
  failure: AdapterValidationFailure,
) => {
  return {
    status: "rejected" as const,
    venue: request.venue,
    symbol: request.symbol.trim().toUpperCase(),
    side: request.side,
    reasonCode: failure.code,
    message: failure.message,
    requestedQuantity: request.quantity,
    requestedNotional: request.notional,
  };
};

const validateCommonRequest = (
  request: MarketOrderRequest,
  rules: VenueRuleConfig,
  price: number,
): ValidationResult => {
  const baseValidation = validateMarketOrderRequest(request);
  if (!baseValidation.success) {
    return makeFailure(
      ADAPTER_ERROR_CODES.INVALID_ORDER_REQUEST,
      baseValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    );
  }

  const normalizedSymbol = request.symbol.trim().toUpperCase();
  if (!rules.symbolPattern.test(normalizedSymbol)) {
    return makeFailure(
      ADAPTER_ERROR_CODES.INVALID_SYMBOL,
      `Symbol ${normalizedSymbol} does not match ${rules.symbolPatternDescription}`,
    );
  }

  if (!rules.isVenueOpen(request)) {
    return makeFailure(ADAPTER_ERROR_CODES.VENUE_CLOSED, `${request.venue} is closed for simulated trading`);
  }

  const quantity = resolveEffectiveQuantity(request, price);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return makeFailure(
      ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE,
      "Unable to resolve a positive quantity from quantity/notional",
    );
  }

  if (rules.minQuantity !== undefined && quantity < rules.minQuantity) {
    return makeFailure(
      ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE,
      `Resolved quantity ${quantity} is below minimum ${rules.minQuantity}`,
    );
  }

  if (!isStepAligned(quantity, rules.quantityStep)) {
    return makeFailure(
      ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE,
      `Resolved quantity ${quantity} does not align with step ${rules.quantityStep}`,
    );
  }

  if (rules.minNotional !== undefined && request.notional !== undefined && request.notional < rules.minNotional) {
    return makeFailure(
      ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE,
      `Notional ${request.notional} is below minimum ${rules.minNotional}`,
    );
  }

  return success;
};

interface CreateAdapterArgs {
  rules: VenueRuleConfig;
  dependencies: AdapterDependencies;
}

export const createSimulatedVenueAdapter = ({ rules, dependencies }: CreateAdapterArgs): SimulatedVenueAdapter => {
  const metadata: VenueRuleMetadata = {
    venue: rules.venue,
    symbolFormat: rules.symbolPatternDescription,
    quantityStep: rules.quantityStep,
    minQuantity: rules.minQuantity,
    minNotional: rules.minNotional,
    tradingHours: rules.tradingHours,
  };

  const validateQuoteRequest = (request: QuoteRequest): ValidationResult => {
    const normalizedSymbol = request.symbol.trim().toUpperCase();
    if (!rules.symbolPattern.test(normalizedSymbol)) {
      return makeFailure(
        ADAPTER_ERROR_CODES.INVALID_SYMBOL,
        `Symbol ${normalizedSymbol} does not match ${rules.symbolPatternDescription}`,
      );
    }

    if (!rules.isVenueOpen(request)) {
      return makeFailure(ADAPTER_ERROR_CODES.VENUE_CLOSED, `${request.venue} is closed for simulated trading`);
    }

    const quotePrice = dependencies.getDeterministicPrice(request);
    const quantity = resolveEffectiveQuantity(request, quotePrice);

    if (quantity > 0 && !isStepAligned(quantity, rules.quantityStep)) {
      return makeFailure(
        ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE,
        `Resolved quantity ${quantity} does not align with step ${rules.quantityStep}`,
      );
    }

    if (rules.minQuantity !== undefined && quantity > 0 && quantity < rules.minQuantity) {
      return makeFailure(
        ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE,
        `Resolved quantity ${quantity} is below minimum ${rules.minQuantity}`,
      );
    }

    if (rules.minNotional !== undefined && request.notional !== undefined && request.notional < rules.minNotional) {
      return makeFailure(
        ADAPTER_ERROR_CODES.INVALID_ORDER_SIZE,
        `Notional ${request.notional} is below minimum ${rules.minNotional}`,
      );
    }

    return success;
  };

  const validateMarketOrder = (request: MarketOrderRequest): ValidationResult => {
    const quotePrice = dependencies.getDeterministicPrice({
      venue: request.venue,
      symbol: request.symbol,
      quantity: request.quantity,
      notional: request.notional,
    });
    return validateCommonRequest(request, rules, quotePrice);
  };

  const buildQuote = (request: QuoteRequest): Quote => {
    const last = dependencies.getDeterministicPrice(request);
    const spread = quoteSpreadByVenue[rules.venue];
    const bid = clampToScale(last * (1 - spread), rules.venue === "polymarket" ? 4 : 8);
    const ask = clampToScale(last * (1 + spread), rules.venue === "polymarket" ? 4 : 8);
    const symbolNormalized = request.symbol.trim().toUpperCase();

    return {
      venue: rules.venue,
      symbol: symbolNormalized,
      bid,
      ask,
      last,
      timestamp: dependencies.getDeterministicTimestamp(request),
      instrumentName: rules.venue === "polymarket" ? displayPolymarketMarket(symbolNormalized) : undefined,
    };
  };

  return {
    venue: rules.venue,
    metadata,
    validateQuoteRequest,
    validateMarketOrder,
    buildQuote,
    async getQuote(request: QuoteRequest): Promise<Quote> {
      const validation = validateQuoteRequest(request);
      if (!validation.ok) {
        throw new Error(`${validation.code}: ${validation.message}`);
      }

      return buildQuote(request);
    },
    async placeMarketOrder(request: MarketOrderRequest) {
      const validation = validateMarketOrder(request);
      if (!validation.ok) {
        return normalizeRejectedOrder(request, validation);
      }

      const quote = buildQuote({
        venue: request.venue,
        symbol: request.symbol,
        quantity: request.quantity,
        notional: request.notional,
      });
      return dependencies.executeOrder(request, quote.last);
    },
  };
};
