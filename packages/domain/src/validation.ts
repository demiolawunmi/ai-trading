import type { MarketOrderRequest, QuoteRequest, Venue } from "./contracts";
import { ORDER_SIDES, VENUES } from "./contracts";

const isVenue = (v: unknown): v is Venue =>
  typeof v === "string" && (VENUES as readonly string[]).includes(v);

const isOrderSide = (s: unknown): s is MarketOrderRequest["side"] =>
  typeof s === "string" && (ORDER_SIDES as readonly string[]).includes(s);

export type ValidationIssue = { path: string; message: string };

export type ValidationResult = { ok: true } | { ok: false; issues: ValidationIssue[] };

const fail = (path: string, message: string): ValidationResult => ({
  ok: false,
  issues: [{ path, message }],
});

const STOCK = /^[A-Z]{1,5}$/;
const CRYPTO = /^[A-Z]{2,10}(USD|USDT|USDC)$/;
const JUPITER = /^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/;
const POLY = /^PM-[A-Z0-9-]{3,32}-(YES|NO)$/;

export const validateSymbolForVenue = (venue: Venue, symbol: string): ValidationResult => {
  const s = symbol.trim().toUpperCase();
  if (!s) return fail("symbol", "Symbol is required.");
  if (venue === "stocks" && !STOCK.test(s)) return fail("symbol", "Invalid stock symbol.");
  if (venue === "crypto" && !CRYPTO.test(s)) return fail("symbol", "Invalid crypto pair.");
  if (venue === "jupiter" && !JUPITER.test(s)) return fail("symbol", "Invalid Jupiter pair.");
  if (venue === "polymarket" && !POLY.test(s)) return fail("symbol", "Invalid Polymarket symbol.");
  return { ok: true };
};

export const validateQuoteRequest = (body: unknown): ValidationResult => {
  if (!body || typeof body !== "object") return fail("$", "Body must be a JSON object.");
  const o = body as Record<string, unknown>;
  if (!isVenue(o.venue)) return fail("venue", "Invalid venue.");
  if (typeof o.symbol !== "string") return fail("symbol", "Symbol must be a string.");
  const sym = validateSymbolForVenue(o.venue, o.symbol);
  if (!sym.ok) return sym;
  if (o.quantity !== undefined) {
    if (typeof o.quantity !== "number" || !Number.isFinite(o.quantity) || o.quantity <= 0) {
      return fail("quantity", "Quantity must be a positive number.");
    }
  }
  if (o.notional !== undefined) {
    if (typeof o.notional !== "number" || !Number.isFinite(o.notional) || o.notional <= 0) {
      return fail("notional", "Notional must be a positive number.");
    }
  }
  return { ok: true };
};

export const validateMarketOrderRequest = (body: unknown): ValidationResult => {
  const base = validateQuoteRequest(body);
  if (!base.ok) return base;
  const o = body as Record<string, unknown>;
  if (!isOrderSide(o.side)) return fail("side", "Side must be buy or sell.");
  return { ok: true };
};

export const validatePortfolioUpdate = (body: unknown): ValidationResult => {
  if (!body || typeof body !== "object") return fail("$", "Body must be a JSON object.");
  const o = body as Record<string, unknown>;
  if (typeof o.baseCurrency !== "string" || !o.baseCurrency.trim()) {
    return fail("baseCurrency", "baseCurrency is required.");
  }
  if (typeof o.cash !== "number" || !Number.isFinite(o.cash)) return fail("cash", "Invalid cash.");
  if (typeof o.buyingPower !== "number" || !Number.isFinite(o.buyingPower)) {
    return fail("buyingPower", "Invalid buyingPower.");
  }
  if (!Array.isArray(o.holdings)) return fail("holdings", "holdings must be an array.");
  return { ok: true };
};
