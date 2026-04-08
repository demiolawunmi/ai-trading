import { describe, expect, it } from "vitest";

import {
  POLYMARKET_CATALOG,
  buildPolymarketSymbol,
  displayPolymarketMarket,
  lookupPolymarketTitle,
  parsePolymarketSymbol,
} from "../src/polymarketCatalog";

describe("polymarketCatalog", () => {
  it("builds and parses symbols", () => {
    const sym = buildPolymarketSymbol("ELECTION", "YES");
    expect(sym).toBe("PM-ELECTION-YES");
    expect(parsePolymarketSymbol(sym)).toEqual({ slug: "ELECTION", outcome: "YES" });
  });

  it("looks up catalog titles", () => {
    const title = lookupPolymarketTitle("PM-ELECTION-NO");
    expect(title).toBe(POLYMARKET_CATALOG.find((e) => e.slug === "ELECTION")?.title);
  });

  it("formats display for catalog markets", () => {
    expect(displayPolymarketMarket("PM-ELECTION-YES")).toContain("2024");
    expect(displayPolymarketMarket("PM-ELECTION-YES")).toContain("YES");
  });

  it("formats display for unknown slugs", () => {
    expect(displayPolymarketMarket("PM-FOO-BAR-BAZ-NO")).toContain("Foo Bar Baz");
    expect(displayPolymarketMarket("PM-FOO-BAR-BAZ-NO")).toContain("NO");
  });
});
