import {
  ORDER_SIDES,
  VENUES,
  type Holding,
  type MarketOrderRequest,
  type PortfolioUpdateRequest,
} from "./contracts";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  issues: ValidationIssue[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const pushIssue = (issues: ValidationIssue[], path: string, message: string): void => {
  issues.push({ path, message });
};

const validateHolding = (value: unknown, path: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, path, "must be an object");
    return issues;
  }

  const venue = value.venue;
  if (typeof venue !== "string" || !VENUES.includes(venue as (typeof VENUES)[number])) {
    pushIssue(issues, `${path}.venue`, `must be one of: ${VENUES.join(", ")}`);
  }

  if (typeof value.symbol !== "string" || value.symbol.trim().length === 0) {
    pushIssue(issues, `${path}.symbol`, "must be a non-empty string");
  }

  if (!isFiniteNumber(value.quantity)) {
    pushIssue(issues, `${path}.quantity`, "must be a finite number");
  }

  if (!isFiniteNumber(value.averageCost)) {
    pushIssue(issues, `${path}.averageCost`, "must be a finite number");
  }

  if (value.marketPrice !== undefined && !isFiniteNumber(value.marketPrice)) {
    pushIssue(issues, `${path}.marketPrice`, "must be a finite number when provided");
  }

  return issues;
};

const hasAnyKey = (record: Record<string, unknown>, keys: string[]): boolean => {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return true;
    }
  }

  return false;
};

const marketOrderRequiredKeys = ["venue", "symbol", "side"];

export const validateMarketOrderRequest = (value: unknown): ValidationResult<MarketOrderRequest> => {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      issues: [{ path: "$", message: "must be an object" }],
    };
  }

  for (const key of marketOrderRequiredKeys) {
    if (!hasAnyKey(value, [key])) {
      pushIssue(issues, `$.${key}`, "is required");
    }
  }

  const venue = value.venue;
  if (venue !== undefined) {
    if (typeof venue !== "string" || !VENUES.includes(venue as (typeof VENUES)[number])) {
      pushIssue(issues, "$.venue", `must be one of: ${VENUES.join(", ")}`);
    }
  }

  const symbol = value.symbol;
  if (symbol !== undefined) {
    if (typeof symbol !== "string" || symbol.trim().length === 0) {
      pushIssue(issues, "$.symbol", "must be a non-empty string");
    }
  }

  const side = value.side;
  if (side !== undefined) {
    if (typeof side !== "string" || !ORDER_SIDES.includes(side as (typeof ORDER_SIDES)[number])) {
      pushIssue(issues, "$.side", `must be one of: ${ORDER_SIDES.join(", ")}`);
    }
  }

  const quantity = value.quantity;
  if (quantity !== undefined) {
    if (!isFiniteNumber(quantity) || quantity <= 0) {
      pushIssue(issues, "$.quantity", "must be a finite number greater than 0 when provided");
    }
  }

  const notional = value.notional;
  if (notional !== undefined) {
    if (!isFiniteNumber(notional) || notional <= 0) {
      pushIssue(issues, "$.notional", "must be a finite number greater than 0 when provided");
    }
  }

  if (quantity === undefined && notional === undefined) {
    pushIssue(issues, "$.quantity", "quantity or notional is required");
    pushIssue(issues, "$.notional", "quantity or notional is required");
  }

  const clientOrderId = value.clientOrderId;
  if (clientOrderId !== undefined) {
    if (typeof clientOrderId !== "string" || clientOrderId.trim().length === 0) {
      pushIssue(issues, "$.clientOrderId", "must be a non-empty string when provided");
    }
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  const data: MarketOrderRequest = {
    venue: value.venue as MarketOrderRequest["venue"],
    symbol: (value.symbol as string).trim(),
    side: value.side as MarketOrderRequest["side"],
  };

  if (quantity !== undefined) {
    data.quantity = quantity as number;
  }

  if (notional !== undefined) {
    data.notional = notional as number;
  }

  if (clientOrderId !== undefined) {
    data.clientOrderId = (clientOrderId as string).trim();
  }

  return { success: true, data, issues: [] };
};

export const validatePortfolioUpdateRequest = (value: unknown): ValidationResult<PortfolioUpdateRequest> => {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      issues: [{ path: "$", message: "must be an object" }],
    };
  }

  if (typeof value.baseCurrency !== "string" || value.baseCurrency.trim().length === 0) {
    pushIssue(issues, "$.baseCurrency", "must be a non-empty string");
  }

  if (!isFiniteNumber(value.cash)) {
    pushIssue(issues, "$.cash", "must be a finite number");
  }

  if (!isFiniteNumber(value.buyingPower)) {
    pushIssue(issues, "$.buyingPower", "must be a finite number");
  }

  if (!Array.isArray(value.holdings)) {
    pushIssue(issues, "$.holdings", "must be an array");
  } else {
    value.holdings.forEach((entry, index) => {
      const holdingIssues = validateHolding(entry, `$.holdings[${index}]`);
      issues.push(...holdingIssues);
    });
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  const holdings = (value.holdings as Holding[]).map((holding) => ({
    venue: holding.venue,
    symbol: holding.symbol.trim(),
    quantity: holding.quantity,
    averageCost: holding.averageCost,
    marketPrice: holding.marketPrice,
  }));

  const data: PortfolioUpdateRequest = {
    baseCurrency: (value.baseCurrency as string).trim(),
    cash: value.cash as number,
    buyingPower: value.buyingPower as number,
    holdings,
  };

  return { success: true, data, issues: [] };
};
