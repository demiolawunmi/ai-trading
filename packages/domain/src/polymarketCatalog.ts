const SYMBOL_RE = /^PM-([A-Z0-9-]{3,32})-(YES|NO)$/;

export type PolymarketOutcome = "YES" | "NO";

export type PolymarketCatalogEntry = {
  slug: string;
  title: string;
};

/** Curated demo markets — slug must match PM-<slug>-YES|NO */
export const POLYMARKET_CATALOG: readonly PolymarketCatalogEntry[] = [
  { slug: "ELECTION", title: "Will Candidate A win the 2024 election?" },
  { slug: "CHAMPIONSHIP", title: "Will Team X win the national championship?" },
  { slug: "FED-RATE-CUT", title: "Will the Fed cut rates before Q3?" },
  { slug: "BTC-100K", title: "Will BTC close above $100k this year?" },
] as const;

export const parsePolymarketSymbol = (
  symbol: string,
): { slug: string; outcome: PolymarketOutcome } | null => {
  const normalized = symbol.trim().toUpperCase();
  const match = SYMBOL_RE.exec(normalized);
  if (!match) return null;
  return { slug: match[1], outcome: match[2] as PolymarketOutcome };
};

export const buildPolymarketSymbol = (slug: string, outcome: PolymarketOutcome): string => {
  return `PM-${slug.trim().toUpperCase()}-${outcome}`;
};

export const lookupPolymarketTitle = (normalizedSymbol: string): string | undefined => {
  const parsed = parsePolymarketSymbol(normalizedSymbol);
  if (!parsed) return undefined;
  return POLYMARKET_CATALOG.find((entry) => entry.slug === parsed.slug)?.title;
};

/** Human-readable line for any valid PM symbol: catalog title or formatted slug + outcome */
export const displayPolymarketMarket = (normalizedSymbol: string): string => {
  const parsed = parsePolymarketSymbol(normalizedSymbol);
  if (!parsed) return normalizedSymbol;
  const catalogTitle = lookupPolymarketTitle(normalizedSymbol);
  if (catalogTitle) {
    return `${catalogTitle} (${parsed.outcome})`;
  }
  const words = parsed.slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
  return `${words} (${parsed.outcome} outcome)`;
};
