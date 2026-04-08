import type {
  MarketOrderRequest,
  MetricsSnapshot,
  OrderResult,
  Position,
  StrategyRun,
  Venue,
} from "./contracts";

export interface DomainEventBase {
  timestamp: string;
  correlationId: string;
}

export interface OrderRequested extends DomainEventBase {
  type: "OrderRequested";
  payload: MarketOrderRequest;
}

export interface OrderAccepted extends DomainEventBase {
  type: "OrderAccepted";
  payload: OrderResult & { status: "accepted" };
}

export interface OrderRejected extends DomainEventBase {
  type: "OrderRejected";
  payload: OrderResult & { status: "rejected" };
}

export interface FillPartial extends DomainEventBase {
  type: "FillPartial";
  payload: {
    orderId: string;
    venue: Venue;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    remainingQuantity: number;
  };
}

export interface FillComplete extends DomainEventBase {
  type: "FillComplete";
  payload: {
    orderId: string;
    venue: Venue;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    averagePrice: number;
  };
}

export interface PortfolioUpdated extends DomainEventBase {
  type: "PortfolioUpdated";
  payload: {
    baseCurrency: string;
    cash: number;
    buyingPower: number;
    positions: Position[];
  };
}

export interface MetricsUpdated extends DomainEventBase {
  type: "MetricsUpdated";
  payload: {
    metrics: MetricsSnapshot;
    strategyRun?: StrategyRun;
  };
}

export type DomainEvent =
  | OrderRequested
  | OrderAccepted
  | OrderRejected
  | FillPartial
  | FillComplete
  | PortfolioUpdated
  | MetricsUpdated;
