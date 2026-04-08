"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMetrics = exports.patchConnectVenue = exports.getConnectState = exports.updateStrategyRun = exports.getStrategyRuns = exports.pushFill = exports.pushOrder = exports.getFills = exports.getOrders = exports.setPortfolio = exports.getPortfolio = void 0;
let portfolio = {
    baseCurrency: "USD",
    cash: 100_000,
    buyingPower: 100_000,
    holdings: [],
};
const getPortfolio = () => ({ ...portfolio, holdings: [...portfolio.holdings] });
exports.getPortfolio = getPortfolio;
const setPortfolio = (next) => {
    portfolio = { ...next, holdings: [...next.holdings] };
};
exports.setPortfolio = setPortfolio;
let orders = [];
let fills = [];
const getOrders = () => [...orders];
exports.getOrders = getOrders;
const getFills = () => [...fills];
exports.getFills = getFills;
const pushOrder = (order) => {
    orders = [order, ...orders].slice(0, 500);
};
exports.pushOrder = pushOrder;
const pushFill = (fill) => {
    fills = [fill, ...fills].slice(0, 500);
};
exports.pushFill = pushFill;
let strategyRuns = [
    {
        id: "run-demo-1",
        strategyId: "demo-momentum",
        status: "registered",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];
const getStrategyRuns = () => [...strategyRuns];
exports.getStrategyRuns = getStrategyRuns;
const updateStrategyRun = (id, patch) => {
    strategyRuns = strategyRuns.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
};
exports.updateStrategyRun = updateStrategyRun;
const connectState = {
    stocks: { venue: "stocks", configured: false, status: "disconnected", updatedAt: "--" },
    crypto: { venue: "crypto", configured: false, status: "disconnected", updatedAt: "--" },
    jupiter: { venue: "jupiter", configured: false, status: "disconnected", updatedAt: "--" },
    polymarket: { venue: "polymarket", configured: false, status: "disconnected", updatedAt: "--" },
};
const getConnectState = () => ({ ...connectState });
exports.getConnectState = getConnectState;
const patchConnectVenue = (venue, patch) => {
    connectState[venue] = { ...connectState[venue], ...patch, venue };
};
exports.patchConnectVenue = patchConnectVenue;
const computeMetrics = () => {
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
exports.computeMetrics = computeMetrics;
