import { randomUUID } from "node:crypto";

import type { MarketOrderRequest, QuoteRequest, Venue } from "@ai-trading/domain";
import { validateMarketOrderRequest, validatePortfolioUpdate, validateQuoteRequest } from "@ai-trading/domain";
import type { FillComplete } from "@ai-trading/domain";
import type { Express, Request, Response } from "express";

import { buildQuote } from "./simulation";
import {
  computeMetrics,
  getConnectState,
  getFills,
  getOrders,
  getPortfolio,
  getStrategyRuns,
  patchConnectVenue,
  pushFill,
  pushOrder,
  setPortfolio,
  updateStrategyRun,
} from "./state";

const jsonError = (res: Response, status: number, code: string, message: string, issues?: unknown) => {
  res.status(status).json({ error: { code, message, issues } });
};

export const registerApi = (app: Express) => {
  app.post("/api/quote", (req: Request, res: Response) => {
    const parsed = validateQuoteRequest(req.body);
    if (!parsed.ok) {
      return jsonError(res, 400, "VALIDATION_ERROR", "Invalid quote request", parsed.issues);
    }
    const body = req.body as QuoteRequest;
    const quote = buildQuote(body);
    res.json(quote);
  });

  app.post("/api/orders/market", (req: Request, res: Response) => {
    const parsed = validateMarketOrderRequest(req.body);
    if (!parsed.ok) {
      return jsonError(res, 400, "VALIDATION_ERROR", "Invalid order request", parsed.issues);
    }
    const body = req.body as MarketOrderRequest;
    const quoteReq: QuoteRequest = {
      venue: body.venue,
      symbol: body.symbol,
      quantity: body.quantity,
      notional: body.notional,
    };
    const q = buildQuote(quoteReq);
    let qty = body.quantity;
    if (qty === undefined && body.notional !== undefined) {
      qty = body.notional / q.last;
    }
    if (qty === undefined || !Number.isFinite(qty) || qty <= 0) {
      return jsonError(res, 400, "INVALID_SIZE", "Could not resolve order quantity.");
    }

    const result = {
      status: "accepted" as const,
      venue: body.venue,
      symbol: body.symbol.trim().toUpperCase(),
      side: body.side,
      orderId: randomUUID(),
      message: "Simulated market order filled.",
      requestedQuantity: body.quantity,
      requestedNotional: body.notional,
      filledQuantity: qty,
      averageFillPrice: q.last,
    };
    pushOrder(result);

    const fill: FillComplete = {
      type: "FillComplete",
      payload: {
        venue: body.venue,
        symbol: body.symbol.trim().toUpperCase(),
        side: body.side,
        quantity: qty,
        averagePrice: q.last,
      },
    };
    pushFill(fill);
    res.json(result);
  });

  app.get("/api/orders", (_req: Request, res: Response) => {
    res.json({ orders: getOrders() });
  });

  app.get("/api/fills", (_req: Request, res: Response) => {
    res.json({ fills: getFills() });
  });

  app.get("/api/portfolio", (_req: Request, res: Response) => {
    res.json(getPortfolio());
  });

  app.post("/api/portfolio", (req: Request, res: Response) => {
    const parsed = validatePortfolioUpdate(req.body);
    if (!parsed.ok) {
      return jsonError(res, 400, "VALIDATION_ERROR", "Invalid portfolio", parsed.issues);
    }
    const body = req.body as {
      baseCurrency: string;
      cash: number;
      buyingPower: number;
      holdings: Array<{ venue: string; symbol: string; quantity: number; averageCost: number; marketPrice?: number }>;
    };
    setPortfolio({
      baseCurrency: body.baseCurrency,
      cash: body.cash,
      buyingPower: body.buyingPower,
      holdings: body.holdings.map((h) => ({
        venue: h.venue as Venue,
        symbol: h.symbol,
        quantity: h.quantity,
        averageCost: h.averageCost,
        marketPrice: h.marketPrice,
      })),
    });
    res.json({ ok: true });
  });

  app.get("/api/metrics", (_req: Request, res: Response) => {
    res.json(computeMetrics());
  });

  app.get("/api/strategy-runs", (_req: Request, res: Response) => {
    res.json({ runs: getStrategyRuns() });
  });

  app.post("/api/strategy-runs/:id/start", (req: Request, res: Response) => {
    const { id } = req.params;
    updateStrategyRun(id, { status: "running", startedAt: new Date().toISOString() });
    res.json({ ok: true });
  });

  app.post("/api/strategy-runs/:id/stop", (req: Request, res: Response) => {
    const { id } = req.params;
    updateStrategyRun(id, { status: "stopped", stoppedAt: new Date().toISOString() });
    res.json({ ok: true });
  });

  app.get("/api/connect/status", (_req: Request, res: Response) => {
    res.json({ venues: getConnectState() });
  });

  app.post("/api/connect/sync", (req: Request, res: Response) => {
    const venues = req.body?.venues as Partial<Record<string, { configured?: boolean }>> | undefined;
    if (venues && typeof venues === "object") {
      for (const key of Object.keys(venues)) {
        const v = key as Venue;
        const cfg = venues[key];
        if (cfg?.configured) {
          patchConnectVenue(v, {
            configured: true,
            status: "connected",
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
    res.json({ ok: true, venues: getConnectState() });
  });
};
