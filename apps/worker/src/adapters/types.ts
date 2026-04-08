import type { MarketOrderRequest, OrderResult, Quote, QuoteRequest, Venue, VenueAdapter } from "@ai-trading/domain";

export const ADAPTER_ERROR_CODES = {
  INVALID_SYMBOL: "INVALID_SYMBOL",
  INVALID_ORDER_SIZE: "INVALID_ORDER_SIZE",
  VENUE_CLOSED: "VENUE_CLOSED",
  INVALID_ORDER_REQUEST: "INVALID_ORDER_REQUEST",
} as const;

export type AdapterErrorCode = (typeof ADAPTER_ERROR_CODES)[keyof typeof ADAPTER_ERROR_CODES];

export interface VenueRuleMetadata {
  venue: Venue;
  symbolFormat: string;
  quantityStep: number;
  minQuantity?: number;
  minNotional?: number;
  tradingHours: string;
}

export interface AdapterValidationResult {
  ok: true;
}

export interface AdapterValidationFailure {
  ok: false;
  code: AdapterErrorCode;
  message: string;
}

export type ValidationResult = AdapterValidationResult | AdapterValidationFailure;

export interface AdapterDependencies {
  getDeterministicTimestamp(request: QuoteRequest | MarketOrderRequest): string;
  getDeterministicPrice(request: QuoteRequest): number;
  executeOrder(request: MarketOrderRequest, quotePrice: number): Promise<OrderResult>;
}

export interface SimulatedVenueAdapter extends VenueAdapter {
  readonly metadata: VenueRuleMetadata;
  validateQuoteRequest(request: QuoteRequest): ValidationResult;
  validateMarketOrder(request: MarketOrderRequest): ValidationResult;
  buildQuote(request: QuoteRequest): Quote;
}
