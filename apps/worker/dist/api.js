"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApi = void 0;
const node_crypto_1 = require("node:crypto");
const domain_1 = require("@ai-trading/domain");
const simulation_1 = require("./simulation");
const state_1 = require("./state");
const jsonError = (res, status, code, message, issues) => {
    res.status(status).json({ error: { code, message, issues } });
};
const registerApi = (app) => {
    app.post("/api/quote", (req, res) => {
        const parsed = (0, domain_1.validateQuoteRequest)(req.body);
        if (!parsed.ok) {
            return jsonError(res, 400, "VALIDATION_ERROR", "Invalid quote request", parsed.issues);
        }
        const body = req.body;
        const quote = (0, simulation_1.buildQuote)(body);
        res.json(quote);
    });
    app.post("/api/orders/market", (req, res) => {
        const parsed = (0, domain_1.validateMarketOrderRequest)(req.body);
        if (!parsed.ok) {
            return jsonError(res, 400, "VALIDATION_ERROR", "Invalid order request", parsed.issues);
        }
        const body = req.body;
        const quoteReq = {
            venue: body.venue,
            symbol: body.symbol,
            quantity: body.quantity,
            notional: body.notional,
        };
        const q = (0, simulation_1.buildQuote)(quoteReq);
        let qty = body.quantity;
        if (qty === undefined && body.notional !== undefined) {
            qty = body.notional / q.last;
        }
        if (qty === undefined || !Number.isFinite(qty) || qty <= 0) {
            return jsonError(res, 400, "INVALID_SIZE", "Could not resolve order quantity.");
        }
        const result = {
            status: "accepted",
            venue: body.venue,
            symbol: body.symbol.trim().toUpperCase(),
            side: body.side,
            orderId: (0, node_crypto_1.randomUUID)(),
            message: "Simulated market order filled.",
            requestedQuantity: body.quantity,
            requestedNotional: body.notional,
            filledQuantity: qty,
            averageFillPrice: q.last,
        };
        (0, state_1.pushOrder)(result);
        const fill = {
            type: "FillComplete",
            payload: {
                venue: body.venue,
                symbol: body.symbol.trim().toUpperCase(),
                side: body.side,
                quantity: qty,
                averagePrice: q.last,
            },
        };
        (0, state_1.pushFill)(fill);
        res.json(result);
    });
    app.get("/api/orders", (_req, res) => {
        res.json({ orders: (0, state_1.getOrders)() });
    });
    app.get("/api/fills", (_req, res) => {
        res.json({ fills: (0, state_1.getFills)() });
    });
    app.get("/api/portfolio", (_req, res) => {
        res.json((0, state_1.getPortfolio)());
    });
    app.post("/api/portfolio", (req, res) => {
        const parsed = (0, domain_1.validatePortfolioUpdate)(req.body);
        if (!parsed.ok) {
            return jsonError(res, 400, "VALIDATION_ERROR", "Invalid portfolio", parsed.issues);
        }
        const body = req.body;
        (0, state_1.setPortfolio)({
            baseCurrency: body.baseCurrency,
            cash: body.cash,
            buyingPower: body.buyingPower,
            holdings: body.holdings.map((h) => ({
                venue: h.venue,
                symbol: h.symbol,
                quantity: h.quantity,
                averageCost: h.averageCost,
                marketPrice: h.marketPrice,
            })),
        });
        res.json({ ok: true });
    });
    app.get("/api/metrics", (_req, res) => {
        res.json((0, state_1.computeMetrics)());
    });
    app.get("/api/strategy-runs", (_req, res) => {
        res.json({ runs: (0, state_1.getStrategyRuns)() });
    });
    app.post("/api/strategy-runs/:id/start", (req, res) => {
        const { id } = req.params;
        (0, state_1.updateStrategyRun)(id, { status: "running", startedAt: new Date().toISOString() });
        res.json({ ok: true });
    });
    app.post("/api/strategy-runs/:id/stop", (req, res) => {
        const { id } = req.params;
        (0, state_1.updateStrategyRun)(id, { status: "stopped", stoppedAt: new Date().toISOString() });
        res.json({ ok: true });
    });
    app.get("/api/connect/status", (_req, res) => {
        res.json({ venues: (0, state_1.getConnectState)() });
    });
    app.post("/api/connect/sync", (req, res) => {
        const venues = req.body?.venues;
        if (venues && typeof venues === "object") {
            for (const key of Object.keys(venues)) {
                const v = key;
                const cfg = venues[key];
                if (cfg?.configured) {
                    (0, state_1.patchConnectVenue)(v, {
                        configured: true,
                        status: "connected",
                        updatedAt: new Date().toISOString(),
                    });
                }
            }
        }
        res.json({ ok: true, venues: (0, state_1.getConnectState)() });
    });
};
exports.registerApi = registerApi;
