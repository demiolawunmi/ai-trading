export const VENUES = ["stocks", "crypto", "jupiter", "polymarket"] as const;

export type Venue = (typeof VENUES)[number];

export const ORDER_SIDES = ["buy", "sell"] as const;

export type OrderSide = (typeof ORDER_SIDES)[number];

export interface MarketOrderRequest {
  venue: Venue;
  symbol: string;
  side: OrderSide;
  quantity?: number;
  notional?: number;
  clientOrderId?: string;
}

export type OrderStatus = "accepted" | "rejected";

export interface OrderResult {
  status: OrderStatus;
  venue: Venue;
  symbol: string;
  side: OrderSide;
  orderId?: string;
  reasonCode?: string;
  message?: string;
  requestedQuantity?: number;
  requestedNotional?: number;
  filledQuantity?: number;
  averageFillPrice?: number;
}

export interface Position {
  venue: Venue;
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface Holding {
  venue: Venue;
  symbol: string;
  quantity: number;
  averageCost: number;
  marketPrice?: number;
}

export interface BalanceState {
  baseCurrency: string;
  cash: number;
  buyingPower: number;
  equity: number;
  holdings: Holding[];
}

export interface PortfolioUpdateRequest {
  baseCurrency: string;
  cash: number;
  buyingPower: number;
  holdings: Holding[];
}

export interface Quote {
  venue: Venue;
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: string;
  /** Human-readable label when the venue provides one (e.g. Polymarket question). */
  instrumentName?: string;
}

export type StrategyRunStatus = "registered" | "running" | "stopped" | "failed";

export interface StrategyRun {
  id: string;
  strategyId: string;
  status: StrategyRunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  stoppedAt?: string;
  failureReason?: string;
}

export interface MetricsSnapshot {
  realizedPnl: number;
  unrealizedPnl: number;
  totalEquity: number;
  maxDrawdown: number;
  winRate: number;
  exposure: number;
}

export interface QuoteRequest {
  venue: Venue;
  symbol: string;
  quantity?: number;
  notional?: number;
}

export interface VenueAdapter {
  readonly venue: Venue;
  getQuote(request: QuoteRequest): Promise<Quote>;
  placeMarketOrder(request: MarketOrderRequest): Promise<OrderResult>;
}
