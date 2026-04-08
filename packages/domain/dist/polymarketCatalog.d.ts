export type PolymarketOutcome = "YES" | "NO";
export type PolymarketCatalogEntry = {
    slug: string;
    title: string;
};
export declare const POLYMARKET_CATALOG: readonly PolymarketCatalogEntry[];
export declare const parsePolymarketSymbol: (symbol: string) => {
    slug: string;
    outcome: PolymarketOutcome;
} | null;
export declare const buildPolymarketSymbol: (slug: string, outcome: PolymarketOutcome) => string;
export declare const lookupPolymarketTitle: (normalizedSymbol: string) => string | undefined;
export declare const displayPolymarketMarket: (normalizedSymbol: string) => string;
