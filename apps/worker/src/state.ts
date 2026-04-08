import type {
  Holding,
  MetricsSnapshot,
  OrderResult,
  StrategyRun,
  Venue,
} from "@ai-trading/domain";
import type { FillComplete, FillPartial } from "@ai-trading/domain";

export type ConnectVenueStatus = {
  venue: Venue;
  configured: boolean;
  status: "connected" | "disconnected";
  updatedAt: string;
};

let portfolio = {
  baseCurrency: "USD",
  cash: 100_000,
  buyingPower: 100_000,
  holdings: [] as Holding[],
};

export const getPortfolio = () => ({ ...portfolio, holdings: [...portfolio.holdings] });

export const setPortfolio = (next: typeof portfolio) => {
  portfolio = { ...next, holdings: [...next.holdings] };
};

let orders: OrderResult[] = [];
let fills: Array<FillPartial | FillComplete> = [];

export const getOrders = () => [...orders];
export const getFills = () => [...fills];

export const pushOrder = (order: OrderResult) => {
  orders = [order, ...orders].slice(0, 500);
};

export const pushFill = (fill: FillPartial | FillComplete) => {
  fills = [fill, ...fills].slice(0, 500);
};

let strategyRuns: StrategyRun[] = [
  {
    id: "run-demo-1",
    strategyId: "demo-momentum",
    status: "registered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const getStrategyRuns = () => [...strategyRuns];

export const updateStrategyRun = (id: string, patch: Partial<StrategyRun>) => {
  strategyRuns = strategyRuns.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
};

const connectState: Record<Venue, ConnectVenueStatus> = {
  stocks: { venue: "stocks", configured: false, status: "disconnected", updatedAt: "--" },
  crypto: { venue: "crypto", configured: false, status: "disconnected", updatedAt: "--" },
  jupiter: { venue: "jupiter", configured: false, status: "disconnected", updatedAt: "--" },
  polymarket: { venue: "polymarket", configured: false, status: "disconnected", updatedAt: "--" },
};

export const getConnectState = (): Record<Venue, ConnectVenueStatus> => ({ ...connectState });

export const patchConnectVenue = (venue: Venue, patch: Partial<ConnectVenueStatus>) => {
  connectState[venue] = { ...connectState[venue], ...patch, venue };
};

export const computeMetrics = (): MetricsSnapshot => {
  const equity = portfolio.cash + portfolio.holdings.reduce((s, h) => s + h.quantity * (h.marketPrice ?? h.averageCost), 0);
  return {
    realizedPnl: 0,
    unrealizedPnl: portfolio.holdings.reduce((s, h) => {
      const m = h.marketPrice ?? h.averageCost;
      return s + (m - h.averageCost) * h.quantity;
    }, 0),
    totalEquity: equity,
    maxDrawdown: 0.02,
    winRate: 0.55,
    exposure: portfolio.holdings.reduce((s, h) => s + Math.abs(h.quantity * (h.marketPrice ?? h.averageCost)), 0) / Math.max(equity, 1),
  };
};
