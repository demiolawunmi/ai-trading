import type { Venue } from "./contracts";
export type ValidationIssue = {
    path: string;
    message: string;
};
export type ValidationResult = {
    ok: true;
} | {
    ok: false;
    issues: ValidationIssue[];
};
export declare const validateSymbolForVenue: (venue: Venue, symbol: string) => ValidationResult;
export declare const validateQuoteRequest: (body: unknown) => ValidationResult;
export declare const validateMarketOrderRequest: (body: unknown) => ValidationResult;
export declare const validatePortfolioUpdate: (body: unknown) => ValidationResult;
