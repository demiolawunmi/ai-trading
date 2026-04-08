import { createHash } from "node:crypto";

import type { Quote, QuoteRequest, Venue } from "@ai-trading/domain";
import { displayPolymarketMarket } from "@ai-trading/domain";

const hashUnit = (input: string): number => {
  const digest = createHash("sha256").update(input).digest("hex");
  return Number.parseInt(digest.slice(0, 8), 16) / 0xffffffff;
};

const basePrice: Record<Venue, number> = {
  stocks: 150,
  crypto: 35000,
  jupiter: 120,
  polymarket: 0.55,
};

const spread: Record<Venue, number> = {
  stocks: 0.001,
  crypto: 0.0015,
  jupiter: 0.002,
  polymarket: 0.003,
};

const clamp = (value: number, scale: number): number => {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
};

export const deterministicPrice = (request: QuoteRequest): number => {
  const normalized = request.symbol.trim().toUpperCase();
  const key = `${request.venue}:${normalized}:${request.quantity ?? "-"}:${request.notional ?? "-"}`;
  const drift = hashUnit(key);
  const center = basePrice[request.venue];
  const variance = request.venue === "polymarket" ? 0.15 : center * 0.1;
  const price = center + (drift * 2 - 1) * variance;
  const scale = request.venue === "polymarket" ? 4 : 8;
  return clamp(Math.max(0.01, price), scale);
};

export const deterministicTimestamp = (request: QuoteRequest): string => {
  const key = `${request.venue}:${request.symbol.trim().toUpperCase()}:${request.quantity ?? "-"}:${request.notional ?? "-"}`;
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  const offsetSeconds = Math.floor(hashUnit(key) * 31_536_000);
  return new Date(base + offsetSeconds * 1000).toISOString();
};

export const buildQuote = (request: QuoteRequest): Quote => {
  const last = deterministicPrice(request);
  const sp = spread[request.venue];
  const scale = request.venue === "polymarket" ? 4 : 8;
  const bid = clamp(last * (1 - sp), scale);
  const ask = clamp(last * (1 + sp), scale);
  const symbolNormalized = request.symbol.trim().toUpperCase();
  return {
    venue: request.venue,
    symbol: symbolNormalized,
    bid,
    ask,
    last,
    timestamp: deterministicTimestamp(request),
    instrumentName: request.venue === "polymarket" ? displayPolymarketMarket(symbolNormalized) : undefined,
  };
};
